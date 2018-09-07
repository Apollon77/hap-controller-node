/**
 * Class to represent a multi-request HTTP connection.
 */
'use strict';

const {HTTPParser} = require('http-parser-js');
const net = require('net');
const sodium = require('libsodium-wrappers');

const State = {
  CLOSED: 0,
  OPENING: 1,
  READY: 2,
  CLOSING: 3,
};

class HttpConnection {
  constructor(address, port) {
    this.address = address;
    this.port = port;
    this.socket = null;
    this.sessionKeys = null;
    this.a2cCounter = 0;
    this.c2aCounter = 0;
  }

  setSessionKeys(keys) {
    this.sessionKeys = keys;
  }

  open() {
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

  get(path) {
    const data = `GET ${path} HTTP/1.1\r\n\r\n`;
    return this.request(data);
  }

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

  put(path, body, contentType = 'application/hap+json') {
    if (typeof body === 'string') {
      body = Buffer.from(body);
    }

    const data = Buffer.concat([
      Buffer.from(`PUT ${path} HTTP/1.1\r\n`),
      Buffer.from(`Content-Type: ${contentType}\r\n`),
      Buffer.from(`Content-Length: ${body.length}\r\n\r\n`),
      body,
    ]);
    return this.request(data);
  }

  request(data) {
    if (this.sessionKeys) {
      return this._requestEncrypted(data);
    }

    return this._requestClear(data);
  }

  _requestEncrypted(data) {
    return this.open().then(() => {
      return new Promise((resolve) => {
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

        this.socket.write(Buffer.concat(encryptedData));

        const parser = new HTTPParser(HTTPParser.RESPONSE);

        let message = Buffer.alloc(0);

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

        this.socket.on('data', bodyParser);

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
          this.socket.removeListener('data', bodyParser);
          resolve({
            statusCode: parser.info.statusCode,
            headers,
            body,
          });
        };
      });
    });
  }

  _requestClear(data) {
    return this.open().then(() => {
      return new Promise((resolve) => {
        this.socket.write(data);

        const parser = new HTTPParser(HTTPParser.RESPONSE);

        const bodyParser = (chunk) => {
          parser.execute(chunk);
        };

        this.socket.on('data', bodyParser);

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
          this.socket.removeListener('data', bodyParser);
          resolve({
            statusCode: parser.info.statusCode,
            headers,
            body,
          });
        };
      });
    });
  }

  close() {
    this.socket.end();
  }
}

module.exports = HttpConnection;
