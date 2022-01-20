/**
 * Class to represent a multi-request HTTP connection.
 */

import { EventEmitter } from 'events';
import HttpEventParser from './http-event-parser';
import net from 'net';
import sodium from 'libsodium-wrappers';
import { HTTPParser } from 'http-parser-js';
import { SessionKeys } from '../../protocol/pairing-protocol';
import Debug from 'debug';
import { OpQueue } from '../../utils/queue';

const debug = Debug('hap-controller:http-connection');

/**
 * Internal socket state.
 */
enum State {
    CLOSED,
    OPENING,
    READY,
    CLOSING,
}

export interface HttpResponse {
    statusCode: number;
    headers: Record<string, string>;
    body: Buffer;
}

export default class HttpConnection extends EventEmitter {
    private address: string;

    private port: number;

    private state: State;

    private socket: net.Socket | null;

    private sessionKeys: SessionKeys | null;

    private a2cCounter: number;

    private c2aCounter: number;

    private queue: OpQueue;

    /**
     * Initialize the HttpConnection object.
     *
     * @param {string} address - IP address of the device
     * @param {number} port - HTTP port
     */
    constructor(address: string, port: number) {
        super();
        this.address = address;
        this.port = port;
        this.state = State.CLOSED;
        this.socket = null;
        this.sessionKeys = null;
        this.a2cCounter = 0;
        this.c2aCounter = 0;
        this.queue = new OpQueue();
    }

    /**
     * Set the session keys for the connection.
     *
     * @param {Object} keys - The session key object obtained from PairingProtocol
     */
    setSessionKeys(keys: SessionKeys): void {
        this.sessionKeys = keys;
    }

    /**
     * Get the State of the connection
     *
     * @returns {Boolean} Connection State
     */
    isConnected(): boolean {
        return this.state === State.READY;
    }

    /**
     * Queue an operation for the connection.
     *
     * @param {function} op - Function to add to the queue
     * @returns {Promise} Promise which resolves when the function is called.
     */
    private _queueOperation<T>(op: () => Promise<T>): Promise<T> {
        return this.queue.queue(op);
    }

    /**
     * Open a socket if necessary.
     *
     * @returns {Promise} Promise which resolves when the socket is open and
     *                    ready.
     */
    private async _open(): Promise<void> {
        if (this.state === State.READY) {
            return;
        } else if (this.state !== State.CLOSED && this.socket) {
            this.socket!.end();
        }

        return new Promise<void>((resolve, reject) => {
            this.state = State.CLOSED;
            try {
                this.socket = net.createConnection(this.port, this.address);
                this.socket!.setKeepAlive(true);

                this.socket!.on('close', () => {
                    this.socket = null;
                    this.state = State.CLOSED;
                    this.emit('disconnect', {});
                });
                this.socket!.on('end', () => {
                    this.state = State.CLOSING;
                    this.socket?.end();
                });
                this.socket!.on('timeout', () => {
                    this.state = State.CLOSING;
                    this.socket?.end();
                });
                this.socket!.on('error', (err) => {
                    reject(err);
                });
                this.socket!.on('connect', () => {
                    this.state = State.READY;
                    resolve();
                });
            } catch (err) {
                reject(err);
            }
        });
    }

    /**
     * Send a GET request.
     *
     * @param {string} path - Path to request
     * @returns {Promise} Promise which resolves to a buffer containing the
     *                    response body.
     */
    get(path: string): Promise<HttpResponse> {
        debug(`${this.address}:${this.port} GET ${path}`);
        const data = Buffer.from(`GET ${path} HTTP/1.1\r\n\r\n`);
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
    post(path: string, body: Buffer | string, contentType = 'application/hap+json'): Promise<HttpResponse> {
        if (typeof body === 'string') {
            body = Buffer.from(body);
        }
        debug(`${this.address}:${this.port} POST ${path} ${body.toString('hex')}`);

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
    put(
        path: string,
        body: Buffer | string,
        contentType = 'application/hap+json',
        readEvents = false
    ): Promise<HttpResponse> {
        if (typeof body === 'string') {
            body = Buffer.from(body);
        }
        debug(`${this.address}:${this.port} PUT ${path} ${body.toString('hex')}`);

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
    request(body: Buffer, readEvents = false): Promise<HttpResponse> {
        return this._queueOperation(async () => {
            if (this.sessionKeys) {
                return this._requestEncrypted(body, readEvents);
            }

            return this._requestClear(body, readEvents);
        });
    }

    /**
     * Encrypt request data.
     *
     * @param {Buffer} data - Data to encrypt
     * @returns {Buffer} Encrypted data.
     */
    private _encryptData(data: Buffer): Buffer {
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
                    this.sessionKeys!.ControllerToAccessoryKey
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
     * @param {(response: HttpResponse) => void} resolve - Function to call with response
     * @returns {Object} HTTPParser object.
     */
    private _buildHttpResponseParser(resolve: (response: HttpResponse) => void): HTTPParser {
        const parser = new HTTPParser(HTTPParser.RESPONSE);

        const headers: Record<string, string> = {};
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
                statusCode: parser.info.statusCode!,
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
    private async _requestEncrypted(data: Buffer, readEvents = false): Promise<HttpResponse> {
        await sodium.ready;
        await this._open();

        return new Promise((resolve, reject) => {
            const oldListeners = <((...args: any[]) => void)[]>this.socket!.listeners('data');
            this.socket!.removeAllListeners('data');

            try {
                this.socket!.write(this._encryptData(data));
            } catch (err) {
                return reject(err);
            }
            let message = Buffer.alloc(0);

            // eslint-disable-next-line prefer-const
            let parser: HTTPParser | HttpEventParser;

            const bodyParser = (chunk: Buffer): void => {
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
                                this.sessionKeys!.AccessoryToControllerKey
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
                this.socket!.removeListener('data', bodyParser);

                for (const l of oldListeners) {
                    this.socket!.on('data', l);
                }

                if (readEvents) {
                    parser = new HttpEventParser();
                    parser.on('event', (ev) => this.emit('event', ev));
                    this.socket!.on('data', bodyParser);
                }

                debug(
                    `${this.address}:${this.port} ` +
                        `Response ${response.statusCode} with ${response.body.length} byte data`
                );
                resolve(response);
            });

            this.socket!.on('data', bodyParser);
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
    private async _requestClear(data: Buffer, readEvents = false): Promise<HttpResponse> {
        await this._open();

        return new Promise((resolve, reject) => {
            const oldListeners = <((...args: any[]) => void)[]>this.socket!.listeners('data');
            this.socket!.removeAllListeners('data');

            try {
                this.socket!.write(data);
            } catch (err) {
                return reject(err);
            }

            // eslint-disable-next-line prefer-const
            let parser: HTTPParser | HttpEventParser;

            const bodyParser = (chunk: Buffer): void => {
                parser.execute(chunk);
            };

            parser = this._buildHttpResponseParser((response) => {
                this.socket!.removeListener('data', bodyParser);

                for (const l of oldListeners) {
                    this.socket!.on('data', l);
                }

                if (readEvents) {
                    parser = new HttpEventParser();
                    parser.on('event', (ev) => this.emit('event', ev));
                    this.socket!.on('data', bodyParser);
                }

                debug(
                    `${this.address}:${this.port} ` +
                        `Response ${response.statusCode} with ${response.body.length} byte data`
                );
                resolve(response);
            });

            this.socket!.on('data', bodyParser);
        });
    }

    /**
     * Close the socket.
     */
    close(): void {
        this.socket?.end();
    }
}
