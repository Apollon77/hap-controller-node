/**
 * Class to represent a multi-request GATT connection.
 */
'use strict';

const {OpQueue, Watcher} = require('./gatt-utils');
const sodium = require('libsodium-wrappers');

class GattConnection {
  /**
   * Initialize the GattConnection object.
   *
   * @param {Object} peripheral - Peripheral object from noble
   */
  constructor(peripheral) {
    this.peripheral = peripheral;
    this.sessionKeys = null;
    this.a2cCounter = 0;
    this.c2aCounter = 0;
    this.queue = new OpQueue();
  }

  /**
   * Queue an operation for the connection.
   *
   * @param {function} op - Function to add to the queue
   * @returns {Promise} Promise which resolves when the function is called.
   */
  _queueOperation(op) {
    return this.queue.queue(op);
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
   * Connect to the peripheral if necessary.
   *
   * @returns {Promise} Promise which resolves when the connection is
   *                    established.
   */
  connect() {
    if (this.peripheral.state === 'connected') {
      return Promise.resolve();
    }

    let initial;
    if (this.peripheral.state !== 'disconnected') {
      initial = new Promise((resolve, reject) => {
        const watcher = new Watcher(this.peripheral, reject);
        this.peripheral.disconnect((err) => {
          watcher.stop();
          if (watcher.rejected) {
            return;
          }

          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    } else {
      initial = Promise.resolve();
    }

    return initial.then(() => {
      return new Promise((resolve, reject) => {
        const watcher = new Watcher(this.peripheral, reject);
        this.peripheral.connect((err) => {
          watcher.stop();
          if (watcher.rejected) {
            return;
          }

          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Disconnect from the peripheral if necessary.
   *
   * @returns {Promise} Promise which resolves when the connection is destroyed.
   */
  disconnect() {
    return new Promise((resolve, reject) => {
      if (this.peripheral.state !== 'disconnected') {
        const watcher = new Watcher(this.peripheral, reject);
        this.peripheral.disconnect((err) => {
          watcher.stop();
          if (watcher.rejected) {
            return;
          }

          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Encrypt a series of PDUs.
   *
   * @param {Buffer[]} pdus - List of PDUs to encrypt
   * @returns {Buffer[]} List of encrypted PDUs.
   */
  _encryptPdus(pdus) {
    const encryptedPdus = [];

    for (const pdu of pdus) {
      let position = 0;

      while (position < pdu.length) {
        const writeNonce = Buffer.alloc(12);
        writeNonce.writeUInt32LE(this.c2aCounter++, 4);

        const frameLength = Math.min(pdu.length - position, 496);

        const frame = Buffer.from(
          sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
            pdu.slice(position, position + frameLength),
            null,
            null,
            writeNonce,
            this.sessionKeys.ControllerToAccessoryKey
          )
        );

        encryptedPdus.push(frame);
        position += frameLength;
      }
    }

    return encryptedPdus;
  }

  /**
   * Decrypt a series of PDUs.
   *
   * @param {Buffer} pdu - PDU to decrypt
   * @returns {Buffer} Decrypted PDU.
   */
  _decryptPdu(pdu) {
    const readNonce = Buffer.alloc(12);
    readNonce.writeUInt32LE(this.a2cCounter++, 4);

    try {
      const decryptedData = Buffer.from(
        sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
          null,
          pdu,
          null,
          readNonce,
          this.sessionKeys.AccessoryToControllerKey
        )
      );

      return decryptedData;
    } catch (e) {
      return pdu;
    }
  }

  /**
   * Write a series of PDUs to a characteristic.
   *
   * @param {Object} characteristic - Characteristic object to write to
   * @param {Buffer[]} pdus - List of PDUs to send
   * @returns {Promise} Promise which resolves to a list of responses when all
   *                    writes are sent.
   */
  writeCharacteristic(characteristic, pdus) {
    return this._queueOperation(() => {
      return this.connect().then(() => {
        const queue = new OpQueue();
        let lastOp = Promise.resolve();

        if (this.sessionKeys) {
          pdus = this._encryptPdus(pdus);
        }

        for (const pdu of pdus) {
          lastOp = queue.queue(() => {
            return new Promise((resolve, reject) => {
              const watcher = new Watcher(this.peripheral, reject);
              characteristic.write(pdu, false, (err) => {
                watcher.stop();
                if (watcher.rejected) {
                  return;
                }

                if (err) {
                  reject(err);
                } else {
                  resolve();
                }
              });
            });
          });
        }

        return lastOp.then(() => {
          return this._readCharacteristicInner(characteristic, []);
        });
      });
    });
  }

  /**
   * Read a series of PDUs from a characteristic.
   *
   * @param {Object} characteristic - Characteristic object to write to
   * @param {Buffer[]} pdus - List of PDUs already read
   * @returns {Promise} Promise which resolves to a list of PDUs.
   */
  _readCharacteristicInner(characteristic, pdus = []) {
    return new Promise((resolve, reject) => {
      const watcher = new Watcher(this.peripheral, reject);
      characteristic.read((err, data) => {
        watcher.stop();
        if (watcher.rejected) {
          return;
        }

        if (err) {
          reject(err);
          return;
        }

        if (this.sessionKeys) {
          data = this._decryptPdu(data);
        }

        pdus.push(data);

        let complete = false;
        if (!data || data.length === 0) {
          complete = true;
        } else {
          const controlField = data.readUInt8(0);
          if ((controlField & 0x80) === 0) {
            // not fragmented or first pdu
            if (data.length >= 5) {
              const length = data.readUInt16LE(3);
              if (length <= data.length - 5) {
                complete = true;
              }
            } else {
              complete = true;
            }
          } else if (pdus.length > 1) {
            const length = pdus[0].readUInt16LE(3);
            let totalRead = pdus[0].length - 5;
            if (pdus.length > 1) {
              pdus.slice(1).forEach((pdu) => {
                totalRead += pdu.length - 2;
              });
            }

            if (totalRead >= length) {
              complete = true;
            }
          }
        }

        if (!complete) {
          resolve(this._readCharacteristicInner(characteristic, pdus));
        } else {
          resolve(pdus);
        }
      });
    });
  }

  /**
   * Read a series of PDUs from a characteristic.
   *
   * @param {Object} characteristic - Characteristic object to write to
   * @returns {Promise} Promise which resolves to a list of PDUs.
   */
  readCharacteristic(characteristic) {
    return this._queueOperation(() => {
      return this.connect().then(() => {
        return this._readCharacteristicInner(characteristic, []);
      });
    });
  }
}

module.exports = GattConnection;
