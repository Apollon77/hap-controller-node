/**
 * Class to represent a multi-request HTTP connection.
 */
'use strict';

const EventEmitter = require('events');
const HttpEventParser = require('./http-event-parser');
const net = require('net');
const sodium = require('libsodium-wrappers');
const {HTTPParser} = require('http-parser-js');

/**
 * Internal socket state.
 */
const State = {
  CLOSED: 0,
  OPENING: 1,
  READY: 2,
  CLOSING: 3,
};

class HttpConnection extends EventEmitter {
  /**
   * Initialize the HttpConnection object.
   *
   * @param {string} address - IP address of the device
   * @param {number} port - HTTP port
   */
  constructor(address, port) {
    super();
    this.address = address;
    this.port = port;
    this.state = State.CLOSED;
    this.socket = null;
    this.sessionKeys = null;
    this.a2cCounter = 0;
    this.c2aCounter = 0;
  }

  /**
   * Set the session keys for the connection.
   *
   * @param {Object} keys - The session key object obtained from PairingProtocol
   */
  setSessionKeys(keys) {
    this.sessionKeys = keys;
  }

  /**
   * Open a socket if necessary.
   *
   * @returns {Promise} Promise which resolves when the socket is open and
   *                    ready.
   */
  _open() {
    if (this.state === State.READY) {
      return Promise.resolve();
    } else if (this.state !== State.CLOSED && this.socket) {
      this.socket.end();
    }

    return new Promise((resolve, reject) => {
      this.state = State.CLOSED;
      this.socket = net.createConnection(this.port, this.address);
      this.socket.setKeepAlive(true);

      this.socket.on('close', () => {
        this.socket = null;
        this.state = State.CLOSED;
        this.emit('disconnect', {});
      });
      this.socket.on('end', () => {
        this.state = State.CLOSING;
        this.socket.end();
      });
      this.socket.on('timeout', () => {
        this.state = State.CLOSING;
        this.socket.end();
      });
      this.socket.on('error', () => {
        reject();
      });
      this.socket.on('connect', () => {
        this.state = State.READY;
        resolve();
      });
    });
  }

  /**
   * Send a GET request.
   *
   * @param {string} path - Path to request
   * @returns {Promise} Promise which resolves to a buffer containing the
   *                    response body.
   */
  get(path) {
    const data = `GET ${path} HTTP/1.1\r\n\r\n`;
    return this.request(data);
  }

  /**
   * Send a POST request.
   *
   * @param {string} path - Path to request
   * @param {Buffer|string} body - Request body
   * @param {string?} contentType - Request content type
   * @returns {Promise} Promise which resolves to a buffer containing the
   *                    response body.
   */
  post(path, body, contentType = 'application/hap+json') {
    if (typeof body === 'string') {
      body = Buffer.from(body);
    }

    const data = Buffer.concat([
      Buffer.from(`POST ${path} HTTP/1.1\r\n`),
      Buffer.from(`Content-Type: ${contentType}\r\n`),
      Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
      body,
    ]);
    return this.request(data);
  }

  /**
   * Send a PUT request.
   *
   * @param {string} path - Path to request
   * @param {Buffer|string} body - Request body
   * @param {string?} contentType - Request content type
   * @param {boolean?} readEvents - Whether or not to read EVENT messages after
   *                   initial request
   * @returns {Promise} Promise which resolves to a buffer containing the
   *                    response body.
   */
  put(path, body, contentType = 'application/hap+json', readEvents = false) {
    if (typeof body === 'string') {
      body = Buffer.from(body);
    }

    const data = Buffer.concat([
      Buffer.from(`PUT ${path} HTTP/1.1\r\n`),
      Buffer.from(`Content-Type: ${contentType}\r\n`),
      Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
      body,
    ]);
    return this.request(data, readEvents);
  }

  /**
   * Send a request.
   *
   * @param {Buffer} body - Request body
   * @param {boolean?} readEvents - Whether or not to read EVENT messages after
   *                   initial request
   * @returns {Promise} Promise which resolves to a buffer containing the
   *                    response body.
   */
  request(body, readEvents) {
    if (this.sessionKeys) {
      return this._requestEncrypted(body, readEvents);
    }

    return this._requestClear(body, readEvents);
  }

  /**
   * Encrypt request data.
   *
   * @param {Buffer} data - Data to encrypt
   * @returns {Buffer} Encrypted data.
   */
  _encryptData(data) {
    const encryptedData = [];
    let position = 0;

    while (position < data.length) {
      const writeNonce = Buffer.alloc(12);
      writeNonce.writeUInt32LE(this.c2aCounter++, 4);

      const frameLength = Math.min(data.length - position, 1024);
      const aad = Buffer.alloc(2);
      aad.writeUInt16LE(frameLength, 0);

      const frame = Buffer.from(
        sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
          data.slice(position, position + frameLength),
          aad,
          null,
          writeNonce,
          this.sessionKeys.ControllerToAccessoryKey
        )
      );

      encryptedData.push(aad);
      encryptedData.push(frame);
      position += frameLength;
    }

    return Buffer.concat(encryptedData);
  }

  /**
   * Create an HTTP response parser.
   *
   * @param {callback} resolve - Function to call with response
   * @returns {Object} HTTPParser object.
   */
  _buildHttpResponseParser(resolve) {
    const parser = new HTTPParser(HTTPParser.RESPONSE);

    const headers = {};
    parser.onHeadersComplete = (res) => {
      for (let i = 0; i < res.headers.length; i += 2) {
        headers[res.headers[i]] = res.headers[i + 1];
      }
    };

    let body = Buffer.alloc(0);
    parser.onBody = (chunk, start, len) => {
      body = Buffer.concat([body, chunk.slice(start, start + len)]);
    };

    parser.onMessageComplete = () => {
      resolve({
        statusCode: parser.info.statusCode,
        headers,
        body,
      });
    };

    return parser;
  }

  /**
   * Send an encrypted request.
   *
   * @param {Buffer} data - Request body
   * @param {boolean?} readEvents - Whether or not to read EVENT messages after
   *                   initial request
   * @returns {Promise} Promise which resolves to a buffer containing the
   *                    response body.
   */
  _requestEncrypted(data, readEvents) {
    return this._open().then(() => {
      return new Promise((resolve) => {
        const oldListeners = this.socket.listeners('data');
        this.socket.removeAllListeners('data');

        this.socket.write(this._encryptData(data));

        let message = Buffer.alloc(0);

        // eslint-disable-next-line prefer-const
        let parser;

        const bodyParser = (chunk) => {
          message = Buffer.concat([message, chunk]);
          while (message.length >= 18) {
            const frameLength = message.readUInt16LE(0);
            if (message.length < frameLength + 18) {
              return;
            }

            const aad = message.slice(0, 2);
            const data = message.slice(2, 18 + frameLength);
            const readNonce = Buffer.alloc(12);
            readNonce.writeUInt32LE(this.a2cCounter, 4);

            try {
              const decryptedData = Buffer.from(
                sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                  null,
                  data,
                  aad,
                  readNonce,
                  this.sessionKeys.AccessoryToControllerKey
                )
              );

              message = message.slice(18 + frameLength, message.length);
              ++this.a2cCounter;
              parser.execute(decryptedData);
            } catch (e) {
              // pass
            }
          }
        };

        parser = this._buildHttpResponseParser((response) => {
          this.socket.removeListener('data', bodyParser);

          for (const l of oldListeners) {
            this.socket.on('data', l);
          }

          if (readEvents) {
            parser = new HttpEventParser();
            parser.on('event', (ev) => this.emit('event', ev));
            this.socket.on('data', bodyParser);
          }

          resolve(response);
        });

        this.socket.on('data', bodyParser);
      });
    });
  }

  /**
   * Send a clear-text request.
   *
   * @param {Buffer} data - Request body
   * @param {boolean?} readEvents - Whether or not to read EVENT messages after
   *                   initial request
   * @returns {Promise} Promise which resolves to a buffer containing the
   *                    response body.
   */
  _requestClear(data, readEvents) {
    return this._open().then(() => {
      return new Promise((resolve) => {
        const oldListeners = this.socket.listeners('data');
        this.socket.removeAllListeners('data');

        this.socket.write(data);

        // eslint-disable-next-line prefer-const
        let parser;
        const bodyParser = (chunk) => {
          parser.execute(chunk);
        };

        parser = this._buildHttpResponseParser((response) => {
          this.socket.removeListener('data', bodyParser);

          for (const l of oldListeners) {
            this.socket.on('data', l);
          }

          if (readEvents) {
            parser = new HttpEventParser();
            parser.on('event', (ev) => this.emit('event', ev));
            this.socket.on('data', bodyParser);
          }

          resolve(response);
        });

        this.socket.on('data', bodyParser);
      });
    });
  }

  /**
   * Close the socket.
   */
  close() {
    this.socket.end();
  }
}

module.exports = HttpConnection;
