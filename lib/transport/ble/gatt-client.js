/**
 * Controller class for interacting with a HAP device over GATT.
 */
'use strict';

const Characteristic = require('../../model/characteristic');
const EventEmitter = require('events');
const GattConnection = require('./gatt-connection');
const GattConstants = require('./gatt-constants');
const GattProtocol = require('./gatt-protocol');
const GattUtils = require('./gatt-utils');
const PairingProtocol = require('../../protocol/pairing-protocol');
const Service = require('../../model/service');
const TLV = require('../../model/tlv');

class GattClient extends EventEmitter {
  /**
   * Initialize the GattClient object.
   *
   * @param {string} deviceId - ID of the device
   * @param {Object} peripheral - Peripheral object from noble
   * @param {Object?} pairingData - existing pairing data
   */
  constructor(deviceId, peripheral, pairingData) {
    super();
    this.deviceId = deviceId;
    this.peripheral = peripheral;
    this.pairingProtocol = new PairingProtocol(pairingData);
    this.gattProtocol = new GattProtocol();
    this.tid = -1;
    this.queue = new GattUtils.OpQueue();
  }

  /**
   * Queue an operation for the client.
   *
   * @param {function} op - Function to add to the queue
   * @returns {Promise} Promise which resolves when the function is called.
   */
  _queueOperation(op) {
    return this.queue.queue(op);
  }

  /**
   * Get the next transaction ID.
   *
   * @returns {number} Transaction ID.
   */
  getNextTransactionId() {
    this.tid++;

    if (this.tid > 255) {
      this.tid = 0;
    }

    return this.tid;
  }

  /**
   * Get the data (keys) that needs to be stored long-term.
   *
   * @returns {Object} Object containing the keys that should be stored.
   */
  getLongTermData() {
    return this.pairingProtocol.getLongTermData();
  }

  /**
   * Run the identify routine on a device.
   *
   * @returns {Promise} Promise which resolves if identify succeeded.
   */
  identify() {
    const serviceUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService(
        'public.hap.service.accessory-information'
      )
    );
    const characteristicUuid = GattUtils.uuidToNobleUuid(
      Characteristic.uuidFromCharacteristic(
        'public.hap.characteristic.identify'
      )
    );

    return this._queueOperation(() => {
      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            [serviceUuid],
            [characteristicUuid],
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              if (characteristics.length === 0) {
                reject('identify characteristic not found');
                return;
              }

              resolve(characteristics[0]);
            }
          );
        });
      }).then((characteristic) => {
        return this._readInstanceId(characteristic).then((iid) => {
          return {iid, characteristic};
        });
      }).then(({iid, characteristic}) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], Buffer.from([1]));
        const pdu =
          this.gattProtocol.buildCharacteristicWriteRequest(
            this.getNextTransactionId(),
            iid,
            data
          );

        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('No response from identify routine');
        }

        const status = pdus[0].readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`Identify returned error status: ${status}`);
        }
      }).then(() => {
        return connection.disconnect()
          .then(() => Promise.resolve())
          .catch(() => Promise.resolve());
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * Read the instance ID descriptor for a characteristic. The peripheral must
   * already be connected.
   *
   * @param {Object} characteristic - The characteristic to read from
   * @returns {Promise} Promise which resolves to the IID.
   */
  _readInstanceId(characteristic) {
    const characteristicInstanceIdUuid = GattUtils.uuidToNobleUuid(
      GattConstants.CharacteristicInstanceIdUuid
    );

    const characteristicInstanceIdShortUuid = GattUtils.uuidToNobleUuid(
      GattConstants.CharacteristicInstanceIdShortUuid
    );

    return new Promise((resolve, reject) => {
      const watcher = new GattUtils.Watcher(this.peripheral, reject);
      characteristic.discoverDescriptors((err, descriptors) => {
        watcher.stop();
        if (watcher.rejected) {
          return;
        }

        if (err) {
          reject(err);
          return;
        }

        const descriptor = descriptors.find((d) => {
          return d.uuid === characteristicInstanceIdUuid ||
            d.uuid === characteristicInstanceIdShortUuid;
        });

        if (!descriptor) {
          reject('Could not find IID');
          return;
        }

        resolve(descriptor);
      });
    }).then((descriptor) => {
      return new Promise((resolve, reject) => {
        const watcher = new GattUtils.Watcher(this.peripheral, reject);
        descriptor.readValue((err, data) => {
          watcher.stop();
          if (watcher.rejected) {
            return;
          }

          if (err) {
            reject(err);
            return;
          }

          resolve(data.readUInt16LE(0));
        });
      });
    });
  }

  /**
   * Begins the pairing process. For devices with random pins, this
   * will cause it to show the pin on the screen.
   *
   * @returns {Promise} Promise which resolves to opaque
   * pairing data when complete.
   */
  async startPairing() {
    const serviceUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService('public.hap.service.pairing')
    );
    const characteristicUuid = GattUtils.uuidToNobleUuid(
      Characteristic.uuidFromCharacteristic(
        'public.hap.characteristic.pairing.pair-setup'
      )
    );

    return this._queueOperation(() => {
      let characteristic, iid;
      const connection = this._pairingConnection =
        new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            [serviceUuid],
            [characteristicUuid],
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              if (characteristics.length === 0) {
                reject('pair-setup characteristic not found');
                return;
              }

              characteristic = characteristics[0];
              resolve(this._readInstanceId(characteristic));
            }
          );
        });
      }).then((instanceId) => {
        iid = instanceId;
        return this.pairingProtocol.buildPairSetupM1();
      }).then((packet) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], packet);
        data.set(
          GattConstants.Types['HAP-Param-Return-Response'],
          Buffer.from([1])
        );
        const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
          this.getNextTransactionId(),
          iid,
          data
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M1: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M1: Got error status: ${status}`);
        }

        if (response.length >= 5) {
          // If a body was included, skip the read request.
          return Promise.resolve(pdus);
        }

        const pdu = this.gattProtocol.buildCharacteristicReadRequest(
          this.getNextTransactionId(),
          iid
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M2: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M2: Got error status: ${status}`);
        }

        const body = TLV.decodeBuffer(
          response.slice(5, response.length)
        );
        return this.pairingProtocol.parsePairSetupM2(
          body.get(GattConstants.Types['HAP-Param-Value'])
        );
      }).then((tlv) => {
        return {tlv, iid, characteristic};
      });
    });
  }

  /**
   * Finishes a pairing process that began with startPairing()
   *
   * @param {Object} pairingData - The pairing data returned from startPairing()
   * @returns {Promise} Promise which resolvew when pairing is complete.
   */
  async finishPairing(pairingData, pin) {
    const {tlv, iid, characteristic} = pairingData;
    const re = /^\d{3}-\d{2}-\d{3}$/;
    if (!re.test(pin)) {
      return Promise.reject('Invalid PIN');
    }

    return this._queueOperation(() => {
      const connection = this._pairingConnection;
      const protocol = this.pairingProtocol;
      return protocol.buildPairSetupM3(tlv, pin).then((packet) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], packet);
        data.set(
          GattConstants.Types['HAP-Param-Return-Response'],
          Buffer.from([1])
        );
        const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
          this.getNextTransactionId(),
          iid,
          data
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M3: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M3: Got error status: ${status}`);
        }

        if (response.length >= 5) {
          // If a body was included, skip the read request.
          return Promise.resolve(pdus);
        }

        const pdu = this.gattProtocol.buildCharacteristicReadRequest(
          this.getNextTransactionId(),
          iid
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M4: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M4: Got error status: ${status}`);
        }

        const buffers = [pdus[0].slice(5, pdus[0].length)];
        pdus.slice(1).map((p) => buffers.push(p.slice(2, p.length)));

        const body = TLV.decodeBuffer(Buffer.concat(buffers));
        return this.pairingProtocol.parsePairSetupM4(
          body.get(GattConstants.Types['HAP-Param-Value'])
        );
      }).then(() => {
        return this.pairingProtocol.buildPairSetupM5();
      }).then((packet) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], packet);
        data.set(
          GattConstants.Types['HAP-Param-Return-Response'],
          Buffer.from([1])
        );
        const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
          this.getNextTransactionId(),
          iid,
          data
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M5: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M5: Got error status: ${status}`);
        }

        if (response.length >= 5) {
          // If a body was included, skip the read request.
          return Promise.resolve(pdus);
        }

        const pdu = this.gattProtocol.buildCharacteristicReadRequest(
          this.getNextTransactionId(),
          iid
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M6: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M6: Got error status: ${status}`);
        }

        const body = TLV.decodeBuffer(
          response.slice(5, response.length)
        );
        return this.pairingProtocol.parsePairSetupM6(
          body.get(GattConstants.Types['HAP-Param-Value'])
        );
      }).then(() => {
        return connection.disconnect()
          .then(() => Promise.resolve())
          .catch(() => Promise.resolve());
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * Attempt to pair with a device.
   *
   * @param {string} pin - The pairing PIN
   * @returns {Promise} Promise which resolves when pairing is complete.
   */
  async pairSetup(pin) {
    return this.finishPairing(await this.startPairing(), pin);
  }

  /**
   * Method used internally to generate session keys for a connection.
   *
   * @param {Object} connection - Existing GattConnection object
   * @returns {Promise} Promise which resolves to the generated session keys.
   */
  _pairVerify(connection) {
    const serviceUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService('public.hap.service.pairing')
    );
    const characteristicUuid = GattUtils.uuidToNobleUuid(
      Characteristic.uuidFromCharacteristic(
        'public.hap.characteristic.pairing.pair-verify'
      )
    );

    let characteristic, iid;
    return new Promise((resolve, reject) => {
      const watcher = new GattUtils.Watcher(this.peripheral, reject);
      this.peripheral.discoverSomeServicesAndCharacteristics(
        [serviceUuid],
        [characteristicUuid],
        (err, services, characteristics) => {
          watcher.stop();
          if (watcher.rejected) {
            return;
          }

          if (err) {
            reject(err);
            return;
          }

          if (characteristics.length === 0) {
            reject('pair-verify characteristic not found');
            return;
          }

          characteristic = characteristics[0];
          resolve(this._readInstanceId(characteristic));
        }
      );
    }).then((instanceId) => {
      iid = instanceId;

      if (this.pairingProtocol.canResume()) {
        return this.pairingProtocol.buildPairResumeM1().then((packet) => {
          const data = new Map();
          data.set(GattConstants.Types['HAP-Param-Value'], packet);
          data.set(
            GattConstants.Types['HAP-Param-Return-Response'],
            Buffer.from([1])
          );
          const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
            this.getNextTransactionId(),
            iid,
            data
          );
          return connection.writeCharacteristic(characteristic, [pdu]);
        }).then((pdus) => {
          if (pdus.length === 0) {
            return Promise.reject('M1: No response');
          }

          const response = pdus[0];
          const status = response.readUInt8(2);
          if (status !== 0) {
            return Promise.reject(`M1: Got error status: ${status}`);
          }

          if (response.length >= 5) {
            // If a body was included, skip the read request.
            return Promise.resolve(pdus);
          }

          const pdu = this.gattProtocol.buildCharacteristicReadRequest(
            this.getNextTransactionId(),
            iid
          );
          return connection.writeCharacteristic(characteristic, [pdu]);
        }).then((pdus) => {
          if (pdus.length === 0) {
            return Promise.reject('M2: No response');
          }

          const response = pdus[0];
          const status = response.readUInt8(2);
          if (status !== 0) {
            return Promise.reject(`M2: Got error status: ${status}`);
          }

          const body = TLV.decodeBuffer(
            response.slice(5, response.length)
          );
          return this.pairingProtocol.parsePairResumeM2(
            body.get(GattConstants.Types['HAP-Param-Value'])
          ).catch(() => {
            return this.pairingProtocol.parsePairVerifyM2(
              body.get(GattConstants.Types['HAP-Param-Value'])
            ).then(() => {
              return this.pairingProtocol.buildPairVerifyM3();
            }).then((packet) => {
              const data = new Map();
              data.set(GattConstants.Types['HAP-Param-Value'], packet);
              data.set(
                GattConstants.Types['HAP-Param-Return-Response'],
                Buffer.from([1])
              );
              const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
                this.getNextTransactionId(),
                iid,
                data
              );
              return connection.writeCharacteristic(characteristic, [pdu]);
            }).then((pdus) => {
              if (pdus.length === 0) {
                return Promise.reject('M3: No response');
              }

              const response = pdus[0];
              const status = response.readUInt8(2);
              if (status !== 0) {
                return Promise.reject(`M3: Got error status: ${status}`);
              }

              if (response.length >= 5) {
                // If a body was included, skip the read request.
                return Promise.resolve(pdus);
              }

              const pdu = this.gattProtocol.buildCharacteristicReadRequest(
                this.getNextTransactionId(),
                iid
              );
              return connection.writeCharacteristic(characteristic, [pdu]);
            }).then((pdus) => {
              if (pdus.length === 0) {
                return Promise.reject('M4: No response');
              }

              const response = pdus[0];
              const status = response.readUInt8(2);
              if (status !== 0) {
                return Promise.reject(`M4: Got error status: ${status}`);
              }

              const body = TLV.decodeBuffer(
                response.slice(5, response.length)
              );
              return this.pairingProtocol.parsePairVerifyM4(
                body.get(GattConstants.Types['HAP-Param-Value'])
              );
            });
          });
        }).then(() => {
          return this.pairingProtocol.getSessionKeys();
        }).then((keys) => {
          return keys;
        });
      } else {
        return this.pairingProtocol.buildPairVerifyM1().then((packet) => {
          const data = new Map();
          data.set(GattConstants.Types['HAP-Param-Value'], packet);
          data.set(
            GattConstants.Types['HAP-Param-Return-Response'],
            Buffer.from([1])
          );
          const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
            this.getNextTransactionId(),
            iid,
            data
          );
          return connection.writeCharacteristic(characteristic, [pdu]);
        }).then((pdus) => {
          if (pdus.length === 0) {
            return Promise.reject('M1: No response');
          }

          const response = pdus[0];
          const status = response.readUInt8(2);
          if (status !== 0) {
            return Promise.reject(`M1: Got error status: ${status}`);
          }

          if (response.length >= 5) {
            // If a body was included, skip the read request.
            return Promise.resolve(pdus);
          }

          const pdu = this.gattProtocol.buildCharacteristicReadRequest(
            this.getNextTransactionId(),
            iid
          );
          return connection.writeCharacteristic(characteristic, [pdu]);
        }).then((pdus) => {
          if (pdus.length === 0) {
            return Promise.reject('M2: No response');
          }

          const response = pdus[0];
          const status = response.readUInt8(2);
          if (status !== 0) {
            return Promise.reject(`M2: Got error status: ${status}`);
          }

          const body = TLV.decodeBuffer(
            response.slice(5, response.length)
          );
          return this.pairingProtocol.parsePairVerifyM2(
            body.get(GattConstants.Types['HAP-Param-Value'])
          );
        }).then(() => {
          return this.pairingProtocol.buildPairVerifyM3();
        }).then((packet) => {
          const data = new Map();
          data.set(GattConstants.Types['HAP-Param-Value'], packet);
          data.set(
            GattConstants.Types['HAP-Param-Return-Response'],
            Buffer.from([1])
          );
          const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
            this.getNextTransactionId(),
            iid,
            data
          );
          return connection.writeCharacteristic(characteristic, [pdu]);
        }).then((pdus) => {
          if (pdus.length === 0) {
            return Promise.reject('M3: No response');
          }

          const response = pdus[0];
          const status = response.readUInt8(2);
          if (status !== 0) {
            return Promise.reject(`M3: Got error status: ${status}`);
          }

          if (response.length >= 5) {
            // If a body was included, skip the read request.
            return Promise.resolve(pdus);
          }

          const pdu = this.gattProtocol.buildCharacteristicReadRequest(
            this.getNextTransactionId(),
            iid
          );
          return connection.writeCharacteristic(characteristic, [pdu]);
        }).then((pdus) => {
          if (pdus.length === 0) {
            return Promise.reject('M4: No response');
          }

          const response = pdus[0];
          const status = response.readUInt8(2);
          if (status !== 0) {
            return Promise.reject(`M4: Got error status: ${status}`);
          }

          const body = TLV.decodeBuffer(
            response.slice(5, response.length)
          );
          return this.pairingProtocol.parsePairVerifyM4(
            body.get(GattConstants.Types['HAP-Param-Value'])
          );
        }).then(() => {
          return this.pairingProtocol.getSessionKeys();
        }).then((keys) => {
          return keys;
        });
      }
    }).then((keys) => {
      connection.setSessionKeys(keys);
    });
  }

  /**
   * Unpair the controller from a device.
   *
   * @param {string} identifier - Identifier of the controller to remove
   * @returns {Promise} Promise which resolves when the process completes.
   */
  removePairing(identifier) {
    const serviceUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService('public.hap.service.pairing')
    );
    const characteristicUuid = GattUtils.uuidToNobleUuid(
      Characteristic.uuidFromCharacteristic(
        'public.hap.characteristic.pairing.pairings'
      )
    );

    return this._queueOperation(() => {
      let characteristic, iid;

      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return this._pairVerify(connection);
      }).then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            [serviceUuid],
            [characteristicUuid],
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              if (characteristics.length === 0) {
                reject('pairings characteristic not found');
                return;
              }

              characteristic = characteristics[0];
              resolve(this._readInstanceId(characteristic));
            }
          );
        });
      }).then((instanceId) => {
        iid = instanceId;
        return this._pairVerify(connection);
      }).then(() => {
        return this.pairingProtocol.buildRemovePairingM1(identifier);
      }).then((packet) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], packet);
        data.set(
          GattConstants.Types['HAP-Param-Return-Response'],
          Buffer.from([1])
        );
        const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
          this.getNextTransactionId(),
          iid,
          data
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M1: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M1: Got error status: ${status}`);
        }

        if (response.length >= 5) {
          // If a body was included, skip the read request.
          return Promise.resolve(pdus);
        }

        const pdu = this.gattProtocol.buildCharacteristicReadRequest(
          this.getNextTransactionId(),
          iid
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M2: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M2: Got error status: ${status}`);
        }

        const body = TLV.decodeBuffer(
          response.slice(5, response.length)
        );
        return this.pairingProtocol.parseRemovePairingM2(
          body.get(GattConstants.Types['HAP-Param-Value'])
        );
      }).then(() => {
        return connection.disconnect()
          .then(() => Promise.resolve())
          .catch(() => Promise.resolve());
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * Add a pairing to a device.
   *
   * @param {string} identifier - Identifier of new controller
   * @param {Buffer} ltpk - Long-term public key of the new controller
   * @param {boolean} isAdmin - Whether or not the new controller is an admin
   * @returns {Promise} Promise which resolves when the process is complete.
   */
  addPairing(identifier, ltpk, isAdmin) {
    const serviceUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService('public.hap.service.pairing')
    );
    const characteristicUuid = GattUtils.uuidToNobleUuid(
      Characteristic.uuidFromCharacteristic(
        'public.hap.characteristic.pairing.pairings'
      )
    );

    return this._queueOperation(() => {
      let characteristic, iid;

      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            [serviceUuid],
            [characteristicUuid],
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              if (characteristics.length === 0) {
                reject('pairings characteristic not found');
                return;
              }

              characteristic = characteristics[0];
              resolve(this._readInstanceId(characteristic));
            }
          );
        });
      }).then((instanceId) => {
        iid = instanceId;
        return this._pairVerify(connection);
      }).then(() => {
        return this.pairingProtocol.buildAddPairingM1(
          identifier,
          ltpk,
          isAdmin
        );
      }).then((packet) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], packet);
        data.set(
          GattConstants.Types['HAP-Param-Return-Response'],
          Buffer.from([1])
        );
        const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
          this.getNextTransactionId(),
          iid,
          data
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M1: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M1: Got error status: ${status}`);
        }

        if (response.length >= 5) {
          // If a body was included, skip the read request.
          return Promise.resolve(pdus);
        }

        const pdu = this.gattProtocol.buildCharacteristicReadRequest(
          this.getNextTransactionId(),
          iid
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M2: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M2: Got error status: ${status}`);
        }

        const body = TLV.decodeBuffer(
          response.slice(5, response.length)
        );
        return this.pairingProtocol.parseAddPairingM2(
          body.get(GattConstants.Types['HAP-Param-Value'])
        );
      }).then(() => {
        return connection.disconnect()
          .then(() => Promise.resolve())
          .catch(() => Promise.resolve());
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * List the pairings on a device.
   *
   * @returns {Promise} Promise which resolves to the final TLV when the process
   *                    is complete.
   */
  listPairings() {
    const serviceUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService('public.hap.service.pairing')
    );
    const characteristicUuid = GattUtils.uuidToNobleUuid(
      Characteristic.uuidFromCharacteristic(
        'public.hap.characteristic.pairing.pairings'
      )
    );

    return this._queueOperation(() => {
      let characteristic, iid;

      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            [serviceUuid],
            [characteristicUuid],
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              if (characteristics.length === 0) {
                reject('pairings characteristic not found');
                return;
              }

              characteristic = characteristics[0];
              resolve(this._readInstanceId(characteristic));
            }
          );
        });
      }).then((instanceId) => {
        iid = instanceId;
        return this._pairVerify(connection);
      }).then(() => {
        return this.pairingProtocol.buildListPairingsM1();
      }).then((packet) => {
        const data = new Map();
        data.set(GattConstants.Types['HAP-Param-Value'], packet);
        data.set(
          GattConstants.Types['HAP-Param-Return-Response'],
          Buffer.from([1])
        );
        const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
          this.getNextTransactionId(),
          iid,
          data
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M1: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M1: Got error status: ${status}`);
        }

        if (response.length >= 5) {
          // If a body was included, skip the read request.
          return Promise.resolve(pdus);
        }

        const pdu = this.gattProtocol.buildCharacteristicReadRequest(
          this.getNextTransactionId(),
          iid
        );
        return connection.writeCharacteristic(characteristic, [pdu]);
      }).then((pdus) => {
        if (pdus.length === 0) {
          return Promise.reject('M2: No response');
        }

        const response = pdus[0];
        const status = response.readUInt8(2);
        if (status !== 0) {
          return Promise.reject(`M2: Got error status: ${status}`);
        }

        const body = TLV.decodeBuffer(
          response.slice(5, response.length)
        );
        return this.pairingProtocol.parseListPairingsM2(
          body.get(GattConstants.Types['HAP-Param-Value'])
        );
      }).then((tlv) => {
        return connection.disconnect()
          .then(() => Promise.resolve(tlv))
          .catch(() => Promise.resolve(tlv));
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * Get the accessory attribute database from a device.
   *
   * @returns {Promise} Promise which resolves to the JSON document.
   */
  getAccessories() {
    const pairingUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService('public.hap.service.pairing')
    );
    const protocolInformationUuid = GattUtils.uuidToNobleUuid(
      Service.uuidFromService(
        'public.hap.service.protocol.information.service'
      )
    );
    const serviceInstanceIdUuid = GattUtils.uuidToNobleUuid(
      GattConstants.ServiceInstanceIdUuid
    );
    const serviceSignatureUuid = GattUtils.uuidToNobleUuid(
      GattConstants.ServiceSignatureUuid
    );

    return this._queueOperation(() => {
      const database = {
        accessories: [
          {
            aid: 1,
            services: [],
          },
        ],
      };

      let allCharacteristics;

      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverAllServicesAndCharacteristics(
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              allCharacteristics = characteristics;

              // Get the Service IIDs
              const queue = new GattUtils.OpQueue();
              let lastOp = Promise.resolve();
              for (const service of services) {
                if (service.uuid === pairingUuid ||
                    service.uuid === protocolInformationUuid) {
                  continue;
                }

                const characteristic = service.characteristics.find((c) => {
                  return c.uuid === serviceInstanceIdUuid;
                });

                if (!characteristic) {
                  continue;
                }

                lastOp = queue.queue(() => {
                  return new Promise((resolve, reject) => {
                    const watcher =
                      new GattUtils.Watcher(this.peripheral, reject);
                    characteristic.read((err, data) => {
                      watcher.stop();
                      if (watcher.rejected) {
                        return;
                      }

                      if (err) {
                        reject(err);
                        return;
                      }

                      database.accessories[0].services.push({
                        iid: data.readUInt16LE(0),
                        type: GattUtils.nobleUuidToUuid(service.uuid),
                        characteristics: service.characteristics
                          .filter((c) => {
                            return c.uuid !== serviceInstanceIdUuid &&
                              c.uuid !== serviceSignatureUuid;
                          })
                          .map(
                            (c) => {
                              return {
                                type: GattUtils.nobleUuidToUuid(c.uuid),
                                ev: false,
                                perms: [],
                                format: 'data',
                              };
                            }
                          ),
                      });
                      resolve();
                    });
                  });
                });
              }

              resolve(lastOp);
            }
          );
        });
      }).then(() => {
        const queue = new GattUtils.OpQueue();
        let lastOp = Promise.resolve();

        const characteristics = [];
        for (const characteristic of allCharacteristics) {
          lastOp = queue.queue(() => {
            return this._readInstanceId(characteristic).then((iid) => {
              const serviceType = GattUtils.nobleUuidToUuid(
                characteristic._serviceUuid
              );
              const characteristicType = GattUtils.nobleUuidToUuid(
                characteristic.uuid
              );

              for (const service of database.accessories[0].services) {
                if (service.type === serviceType) {
                  for (const characteristic of service.characteristics) {
                    if (characteristic.type === characteristicType) {
                      characteristic.iid = iid;
                      break;
                    }
                  }
                  break;
                }
              }
              characteristics.push({characteristic, iid});
            }).catch(() => {
              // Ignore errors here, as not all characteristics will have IIDs
            });
          });
        }

        return lastOp.then(() => characteristics);
      }).then((characteristics) => {
        return this._pairVerify(connection).then(() => characteristics);
      }).then((characteristics) => {
        const queue = new GattUtils.OpQueue();
        let lastOp = Promise.resolve();

        for (const c of characteristics) {
          const serviceUuid = GattUtils.nobleUuidToUuid(
            c.characteristic._serviceUuid
          );
          const characteristicUuid = GattUtils.nobleUuidToUuid(
            c.characteristic.uuid
          );

          if (characteristicUuid === GattConstants.ServiceSignatureUuid) {
            const pdu = this.gattProtocol.buildCharacteristicReadRequest(
              this.getNextTransactionId(),
              c.iid
            );

            lastOp = queue.queue(() => {
              return connection.writeCharacteristic(
                c.characteristic,
                [pdu]
              ).then((pdus) => {
                if (pdus.length === 0) {
                  return;
                }

                const response = pdus[0];
                const body = TLV.decodeBuffer(
                  response.slice(5, response.length)
                );
                const value = body.get(GattConstants.Types['HAP-Param-Value']);
                if (!value) {
                  return;
                }

                for (const service of database.accessories[0].services) {
                  if (service.type === serviceUuid) {
                    switch (value.readUInt16LE(0)) {
                      case 1:
                        service.primary = true;
                        break;
                      case 2:
                        service.hidden = true;
                        break;
                    }

                    break;
                  }
                }
              });
            });
          }
        }

        return lastOp.then(() => characteristics);
      }).then((characteristics) => {
        const toFetch = [];
        for (const c of characteristics) {
          const serviceUuid = GattUtils.nobleUuidToUuid(
            c.characteristic._serviceUuid
          );
          const characteristicUuid = GattUtils.nobleUuidToUuid(
            c.characteristic.uuid
          );

          if (characteristicUuid !== GattConstants.ServiceSignatureUuid &&
              c.characteristic._serviceUuid !== protocolInformationUuid &&
              c.characteristic._serviceUuid !== pairingUuid) {
            toFetch.push({
              serviceUuid,
              characteristicUuid,
              iid: c.iid,
            });
          }
        }

        return this.getCharacteristics(
          toFetch,
          {
            meta: true,
            perms: true,
            ev: true,
            type: true,
            extra: true,
          },
          connection
        ).then((list) => {
          for (const entry of list.characteristics) {
            if (!entry) {
              continue;
            }

            const service = database.accessories[0].services.find((s) => {
              return s.type === entry.serviceUuid;
            });

            if (!service) {
              continue;
            }

            const characteristic = service.characteristics.find((c) => {
              return c.iid === entry.iid;
            });

            if (!characteristic) {
              continue;
            }

            delete entry.serviceUuid;
            Object.assign(characteristic, entry);
          }
        });
      }).then(() => {
        return connection.disconnect()
          .then(() => Promise.resolve(database))
          .catch(() => Promise.resolve(database));
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * Read a set of characteristics.
   *
   * @param {Object[]} characteristics - Characteristics to get, as a list of
   *                   objects: {characteristicUuid, serviceUuid, iid, format}
   * @param {Object?} options - Options dictating what metadata to fetch
   * @param {Object?} connection - Existing GattConnection object, must already
   *                  be paired and verified
   * @returns {Promise} Promise which resolves to the JSON document.
   */
  getCharacteristics(characteristics, options = {}, connection = null) {
    const skipQueue = connection !== null;

    const fn = () => {
      options = Object.assign(
        {
          meta: false,
          perms: false,
          type: false,
          ev: false,
          extra: false,
        },
        options
      );

      const cList = [];

      let promise;
      let needToClose = false;
      if (connection) {
        promise = Promise.resolve();
      } else {
        needToClose = true;
        connection = new GattConnection(this.peripheral);
        promise = connection.connect().then(() => {
          return this._pairVerify(connection);
        });
      }

      return promise.then(() => {
        for (const c of characteristics) {
          c.characteristicUuid = GattUtils.uuidToNobleUuid(
            c.characteristicUuid
          );
          c.serviceUuid = GattUtils.uuidToNobleUuid(c.serviceUuid);
        }

        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            characteristics.map((c) => c.serviceUuid),
            characteristics.map((c) => c.characteristicUuid),
            (err, discoveredServices, discoveredCharacteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              for (const c of characteristics) {
                const characteristic = discoveredCharacteristics.find((d) => {
                  return d._serviceUuid === c.serviceUuid &&
                    d.uuid === c.characteristicUuid;
                });

                if (!characteristic) {
                  reject(`Characteristic not found: ${JSON.stringify(c)}`);
                  break;
                }

                cList.push(characteristic);
              }

              resolve();
            }
          );
        });
      }).then(() => {
        if (!options.meta && !options.perms && !options.extra) {
          return Promise.resolve([]);
        }

        const queue = new GattUtils.OpQueue();
        let lastOp = Promise.resolve();
        const entries = [];

        for (const c of cList) {
          const match = characteristics.find((ch) => {
            return ch.serviceUuid === c._serviceUuid &&
              ch.characteristicUuid === c.uuid;
          });

          if (!match) {
            continue;
          }

          const iid = match.iid;
          const pdu = this.gattProtocol.buildCharacteristicSignatureReadRequest(
            this.getNextTransactionId(),
            iid
          );

          lastOp = queue.queue(() => {
            return connection.writeCharacteristic(c, [pdu]).then((pdus) => {
              if (pdus.length === 0) {
                return Promise.reject('No sgnature read response');
              }

              const entry = {aid: 1, iid};
              const response = pdus[0];
              const status = response.readUInt8(2);
              if (status !== 0) {
                return Promise.reject(
                  `Got error status while reading signature: ${status}`
                );
              }

              const body = TLV.decodeBuffer(
                response.slice(5, response.length)
              );

              const properties = body.get(
                GattConstants.Types[
                  'HAP-Param-HAP-Characteristic-Properties-Descriptor'
                ]
              );

              if (properties && options.perms) {
                entry.perms = [];

                const value = properties.readUInt16LE(0);
                if (value & 0x0004) {
                  entry.perms.push('aa');
                }
                if (value & 0x0008) {
                  entry.perms.push('tw');
                }
                if (value & 0x0010) {
                  entry.perms.push('pr');
                }
                if (value & 0x0020) {
                  entry.perms.push('pw');
                }
                if (value & 0x0040) {
                  entry.perms.push('hd');
                }
                if (value & 0x0080 || value & 0x0100) {
                  entry.perms.push('ev');
                }
              }

              const description = body.get(
                GattConstants.Types[
                  'HAP-Param-GATT-User-Description-Descriptor'
                ]
              );
              if (description && options.extra) {
                entry.description = description.toString();
              }

              const format = body.get(
                GattConstants.Types[
                  'HAP-Param-GATT-Presentation-Format-Descriptor'
                ]
              );
              if (format && options.meta) {
                const sigFormat = format.readUInt8(0);
                const hapFormat = GattConstants.BTSigToHapFormat[sigFormat];
                if (hapFormat) {
                  entry.format = hapFormat;
                }

                const sigUnit = format.readUInt16LE(3);
                const hapUnit = GattConstants.BTSigToHapUnit[sigUnit];
                if (hapUnit) {
                  entry.unit = hapUnit;
                }
              }

              const validRange = body.get(
                GattConstants.Types[
                  'HAP-Param-GATT-Valid-Range'
                ]
              );

              if (validRange && options.meta && entry.format) {
                switch (entry.format) {
                  case 'uint8':
                    entry.minValue = validRange.readUInt8(0);
                    entry.maxValue = validRange.readUInt8(1);
                    break;
                  case 'uint16':
                    entry.minValue = validRange.readUInt16LE(0);
                    entry.maxValue = validRange.readUInt16LE(2);
                    break;
                  case 'uint32':
                    entry.minValue = validRange.readUInt32LE(0);
                    entry.maxValue = validRange.readUInt32LE(4);
                    break;
                  case 'uint64':
                    entry.minValue = validRange.readUInt32LE(0) ||
                      (validRange.readUInt32LE(4) << 32);
                    entry.maxValue = validRange.readUInt32LE(8) ||
                      (validRange.readUInt32LE(16) << 32);
                    break;
                  case 'int':
                    entry.minValue = validRange.readInt32LE(0);
                    entry.maxValue = validRange.readInt32LE(4);
                    break;
                  case 'float':
                    entry.minValue = validRange.readFloatLE(0);
                    entry.maxValue = validRange.readFloatLE(4);
                    break;
                }

                if (!Number.isFinite(entry.minValue)) {
                  delete entry.minValue;
                }

                if (!Number.isFinite(entry.maxValue)) {
                  delete entry.maxValue;
                }
              }

              const stepValue = body.get(
                GattConstants.Types[
                  'HAP-Param-HAP-Step-Value-Descriptor'
                ]
              );
              if (stepValue && options.meta && entry.format) {
                switch (entry.format) {
                  case 'uint8':
                    entry.minStep = stepValue.readUInt8(0);
                    break;
                  case 'uint16':
                    entry.minStep = stepValue.readUInt16LE(0);
                    break;
                  case 'uint32':
                    entry.minStep = stepValue.readUInt32LE(0);
                    break;
                  case 'uint64':
                    entry.minStep = stepValue.readUInt32LE(0) ||
                      (stepValue.readUInt32LE(4) << 32);
                    break;
                  case 'int':
                    entry.minStep = stepValue.readInt32LE(0);
                    break;
                  case 'float':
                    entry.minStep = stepValue.readFloatLE(0);
                    break;
                }
              }

              const validValues = body.get(
                GattConstants.Types[
                  'HAP-Param-HAP-Valid-Values-Descriptor'
                ]
              );
              if (validValues && options.extra) {
                entry['valid-values'] = Array.from(
                  validValues.values()
                );
              }

              const validValuesRange = body.get(
                GattConstants.Types[
                  'HAP-Param-HAP-Valid-Values-Range-Descriptor'
                ]
              );
              if (validValuesRange && options.extra) {
                entry['valid-values-range'] = [];
                Array.from(validValuesRange.values())
                  .reduce((result, value, index, array) => {
                    if (index % 2 === 0) {
                      entry['valid-values-range'].push(
                        array.slice(index, index + 2)
                      );
                    }

                    return entry['valid-values-range'];
                  }, []);
              }

              entries.push(entry);
            });
          });
        }

        return lastOp.then(() => entries);
      }).then((entries) => {
        const queue = new GattUtils.OpQueue();
        let lastOp = Promise.resolve();
        const updatedEntries = [];

        for (const c of cList) {
          const match = characteristics.find((ch) => {
            return ch.serviceUuid === c._serviceUuid &&
              ch.characteristicUuid === c.uuid;
          });

          if (!match) {
            continue;
          }

          const iid = match.iid;
          const pdu = this.gattProtocol.buildCharacteristicReadRequest(
            this.getNextTransactionId(),
            iid
          );

          let entry = entries.find((e) => e.iid === iid);
          if (!entry) {
            entry = {aid: 1, iid};
          }

          if (options.ev) {
            entry.ev = false;
          }

          if (options.type) {
            entry.type = GattUtils.nobleUuidToUuid(c.uuid);
          }

          if (options.extra) {
            entry.serviceUuid = GattUtils.nobleUuidToUuid(c._serviceUuid);
          }

          lastOp = queue.queue(() => {
            return connection.writeCharacteristic(c, [pdu]).then((pdus) => {
              if (pdus.length === 0) {
                return;
              }

              const response = pdus[0];
              const body = TLV.decodeBuffer(
                response.slice(5, response.length)
              );
              const value = body.get(GattConstants.Types['HAP-Param-Value']);
              if (!value) {
                return;
              }

              if (entry.format) {
                entry.value = GattUtils.bufferToValue(value, entry.format);
              } else if (match.format) {
                entry.value = GattUtils.bufferToValue(value, match.format);
              }

              updatedEntries.push(entry);
            }).catch(() => {
              // If an error occurs here, go ahead and push the entry without a
              // value.
              updatedEntries.push(entry);
            });
          });
        }

        return lastOp.then(() => updatedEntries);
      }).then((ret) => {
        ret = {characteristics: ret};

        if (needToClose) {
          return connection.disconnect()
            .then(() => Promise.resolve(ret))
            .catch(() => Promise.resolve(ret));
        } else {
          return Promise.resolve(ret);
        }
      }).catch((err) => {
        if (needToClose) {
          return connection.disconnect().catch(() => {})
            .then(() => Promise.reject(err));
        } else {
          return Promise.reject(err);
        }
      });
    };

    if (skipQueue) {
      return fn();
    }

    return this._queueOperation(fn);
  }

  /**
   * Modify a set of characteristics.
   *
   * @param {Object[]} values - Characteristics to set, as a list of objects:
   *                   {characteristicUuid, serviceUuid, iid, value}
   * @returns {Promise} Promise which resolves to the JSON document.
   */
  setCharacteristics(values) {
    return this._queueOperation(() => {
      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return this._pairVerify(connection);
      }).then(() => {
        for (const v of values) {
          v.characteristicUuid = GattUtils.uuidToNobleUuid(
            v.characteristicUuid
          );
          v.serviceUuid = GattUtils.uuidToNobleUuid(v.serviceUuid);
        }

        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            values.map((c) => c.serviceUuid),
            values.map((c) => c.characteristicUuid),
            (err, services, characteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              const queue = new GattUtils.OpQueue();
              let lastOp = Promise.resolve();

              for (const v of values) {
                const characteristic = characteristics.find((c) => {
                  return c._serviceUuid === v.serviceUuid;
                });

                if (!characteristic) {
                  reject(`Characteristic not found: ${JSON.stringify(v)}`);
                  break;
                }

                const data = new Map();
                data.set(GattConstants.Types['HAP-Param-Value'], v.value);
                const pdu =
                  this.gattProtocol.buildCharacteristicWriteRequest(
                    this.getNextTransactionId(),
                    v.iid,
                    data
                  );

                lastOp = queue.queue(() => {
                  return connection.writeCharacteristic(characteristic, [pdu]);
                });
              }

              resolve(lastOp);
            }
          );
        });
      }).then(() => {
        return connection.disconnect()
          .then(() => Promise.resolve())
          .catch(() => Promise.resolve());
      }).catch((err) => {
        return connection.disconnect().catch(() => {})
          .then(() => Promise.reject(err));
      });
    });
  }

  /**
   * Subscribe to events for a set of characteristics.
   *
   * @param {Object[]} characteristics - Characteristics to subscribe to, as a
   *                   list of objects:
   *                   {characteristicUuid, serviceUuid, iid, format}
   * @returns {Promise} Promise which resolves to the GattConnection object.
   */
  subscribeCharacteristics(characteristics) {
    return this._queueOperation(() => {
      for (const c of characteristics) {
        c.characteristicUuid = GattUtils.uuidToNobleUuid(c.characteristicUuid);
        c.serviceUuid = GattUtils.uuidToNobleUuid(c.serviceUuid);
      }

      const connection = new GattConnection(this.peripheral);
      return connection.connect().then(() => {
        return new Promise((resolve, reject) => {
          const watcher = new GattUtils.Watcher(this.peripheral, reject);
          this.peripheral.discoverSomeServicesAndCharacteristics(
            characteristics.map((c) => c.serviceUuid),
            characteristics.map((c) => c.characteristicUuid),
            (err, discoveredServices, discoveredCharacteristics) => {
              watcher.stop();
              if (watcher.rejected) {
                return;
              }

              if (err) {
                reject(err);
                return;
              }

              const queue = new GattUtils.OpQueue();
              let lastOp = Promise.resolve();

              for (const c of characteristics) {
                const characteristic = discoveredCharacteristics.find((d) => {
                  return d._serviceUuid === c.serviceUuid &&
                    d.uuid === c.characteristicUuid;
                });

                if (!characteristic) {
                  reject(`Characteristic not found: ${JSON.stringify(c)}`);
                  return;
                }

                lastOp = queue.queue(() => {
                  return new Promise((resolve, reject) => {
                    const watcher =
                      new GattUtils.Watcher(this.peripheral, reject);
                    characteristic.subscribe((err) => {
                      watcher.stop();
                      if (watcher.rejected) {
                        return;
                      }

                      if (err) {
                        reject(`Failed to subscribe: ${err}`);
                      } else {
                        resolve();
                      }
                    });
                  });
                });

                characteristic.on('data', (data) => {
                  // Indications come up as empty buffers. A characteristic read
                  // should be triggered when this happens.
                  if (Buffer.isBuffer(data) && data.length === 0) {
                    this.getCharacteristics([c], {}, connection).then((res) => {
                      this.emit('event', res);
                    });
                  }
                });
              }

              resolve(lastOp);
            }
          );
        });
      }).then(() => connection);
    });
  }

  /**
   * Unsubscribe from events for a set of characteristics.
   *
   * @param {Object[]} characteristics - Characteristics to unsubscribe from, as
   *                   a list of objects: {characteristicUuid, serviceUuid}
   * @returns {Promise} Promise which resolves when the procedure is done.
   */
  unsubscribeCharacteristics(characteristics) {
    for (const c of characteristics) {
      c.characteristicUuid = GattUtils.uuidToNobleUuid(c.characteristicUuid);
      c.serviceUuid = GattUtils.uuidToNobleUuid(c.serviceUuid);
    }

    return new Promise((resolve, reject) => {
      const watcher = new GattUtils.Watcher(this.peripheral, reject);
      this.peripheral.discoverSomeServicesAndCharacteristics(
        characteristics.map((c) => c.serviceUuid),
        characteristics.map((c) => c.characteristicUuid),
        (err, discoveredServices, discoveredCharacteristics) => {
          watcher.stop();
          if (watcher.rejected) {
            return;
          }

          if (err) {
            reject(err);
            return;
          }

          const queue = new GattUtils.OpQueue();
          let lastOp = Promise.resolve();

          for (const c of characteristics) {
            const characteristic = discoveredCharacteristics.find((d) => {
              return d._serviceUuid === c.serviceUuid &&
                d.uuid === c.characteristicUuid;
            });

            if (!characteristic) {
              reject(`Characteristic not found: ${JSON.stringify(c)}`);
              return;
            }

            lastOp = queue.queue(() => {
              return new Promise((resolve, reject) => {
                const watcher = new GattUtils.Watcher(this.peripheral, reject);
                characteristic.unsubscribe((err) => {
                  watcher.stop();
                  if (watcher.rejected) {
                    return;
                  }

                  if (err) {
                    reject(`Failed to unsubscribe: ${err}`);
                  } else {
                    resolve();
                  }
                });
              });
            });
          }

          resolve(lastOp);
        }
      );
    });
  }
}

module.exports = GattClient;
