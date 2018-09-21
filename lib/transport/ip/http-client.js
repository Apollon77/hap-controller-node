/**
 * Controller class for interacting with a HAP device over HTTP.
 */
'use strict';

const EventEmitter = require('events');
const HttpConnection = require('./http-connection');
const PairingProtocol = require('../../protocol/pairing-protocol');

class HttpClient extends EventEmitter {
  /**
   * Initialize the HttpClient object.
   *
   * @param {string} deviceId - ID of the device
   * @param {string} address - IP address of the device
   * @param {number} port - HTTP port
   * @param {Object?} pairingData - existing pairing data
   */
  constructor(deviceId, address, port, pairingData) {
    super();
    this.deviceId = deviceId;
    this.address = address;
    this.port = port;
    this.pairingProtocol = new PairingProtocol(pairingData);
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
   * This can only be done before pairing.
   *
   * @returns {Promise} Promise which resolves if identify succeeded.
   */
  identify() {
    const connection = new HttpConnection(this.address, this.port);
    return connection.post(
      '/identify',
      Buffer.alloc(0)
    ).then((response) => {
      connection.close();

      return new Promise((resolve, reject) => {
        if (response.statusCode === 204) {
          resolve();
        } else {
          reject(`Identify failed with status ${response.statusCode}`);
        }
      });
    });
  }

  /**
   * Attempt to pair with a device.
   *
   * @param {string} pin - The pairing PIN
   * @returns {Promise} Promise which resolves when pairing is complete.
   */
  pairSetup(pin) {
    const re = /^\d{3}-\d{2}-\d{3}$/;
    if (!re.test(pin)) {
      return Promise.reject('Invalid PIN');
    }

    const connection = new HttpConnection(this.address, this.port);
    return this.pairingProtocol.buildPairSetupM1().then((packet) => {
      return connection.post('/pair-setup', packet, 'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parsePairSetupM2(response.body);
    }).then((tlv) => {
      return this.pairingProtocol.buildPairSetupM3(tlv, pin);
    }).then((packet) => {
      return connection.post('/pair-setup', packet, 'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parsePairSetupM4(response.body);
    }).then(() => {
      return this.pairingProtocol.buildPairSetupM5();
    }).then((packet) => {
      return connection.post('/pair-setup', packet, 'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parsePairSetupM6(response.body);
    }).then(() => {
      connection.close();
    });
  }

  /**
   * Method used internally to generate session keys for a connection.
   *
   * @param {Object} connection - Existing HttpConnection object
   * @returns {Promise} Promise which resolves to the generated session keys.
   */
  _pairVerify(connection) {
    return this.pairingProtocol.buildPairVerifyM1().then((packet) => {
      return connection.post('/pair-verify',
                             packet,
                             'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parsePairVerifyM2(response.body);
    }).then(() => {
      return this.pairingProtocol.buildPairVerifyM3();
    }).then((packet) => {
      return connection.post('/pair-verify',
                             packet,
                             'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parsePairVerifyM4(response.body);
    }).then(() => {
      return this.pairingProtocol.getSessionKeys();
    }).then((keys) => {
      return keys;
    });
  }

  /**
   * Unpair the controller from a device.
   *
   * @param {string} identifier - Identifier of the controller to remove
   * @returns {Promise} Promise which resolves when the process completes.
   */
  removePairing(identifier) {
    const connection = new HttpConnection(this.address, this.port);
    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      return this.pairingProtocol.buildRemovePairingM1(identifier);
    }).then((packet) => {
      return connection.post('/pairings', packet, 'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parseRemovePairingM2(response.body);
    }).then(() => {
      connection.close();
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
    const connection = new HttpConnection(this.address, this.port);
    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      return this.pairingProtocol.buildAddPairingM1(identifier, ltpk, isAdmin);
    }).then((packet) => {
      return connection.post('/pairings', packet, 'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parseAddPairingM2(response.body);
    }).then(() => {
      connection.close();
    });
  }

  /**
   * List the pairings on a device.
   *
   * @returns {Promise} Promise which resolves to the final TLV when the process
   *                    is complete.
   */
  listPairings() {
    const connection = new HttpConnection(this.address, this.port);
    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      return this.pairingProtocol.buildListPairingsM1();
    }).then((packet) => {
      return connection.post('/pairings', packet, 'application/pairing+tlv8');
    }).then((response) => {
      return this.pairingProtocol.parseListPairingsM2(response.body);
    }).then((tlv) => {
      connection.close();
      return tlv;
    });
  }

  /**
   * Get the accessory attribute database from a device.
   *
   * @returns {Promise} Promise which resolves to the JSON document.
   */
  getAccessories() {
    const connection = new HttpConnection(this.address, this.port);
    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      return connection.get('/accessories');
    }).then((response) => {
      connection.close();

      return new Promise((resolve, reject) => {
        if (response.statusCode === 200) {
          resolve(JSON.parse(response.body));
        } else {
          reject(`Get failed with status ${response.statusCode}`);
        }
      });
    });
  }

  /**
   * Read a set of characteristics.
   *
   * @param {string[]} characteristics - List of characteristics ID to get
   * @param {Object?} options - Options dictating what metadata to fetch
   * @returns {Promise} Promise which resolves to the JSON document.
   */
  getCharacteristics(characteristics, options = {}) {
    options = Object.assign(
      {
        meta: false,
        perms: false,
        type: false,
        ev: false,
      },
      options
    );
    const connection = new HttpConnection(this.address, this.port);
    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      let path = `/characteristics?id=${characteristics.join(',')}`;
      if (options.meta) {
        path += '&meta=1';
      }
      if (options.perms) {
        path += '&perms=1';
      }
      if (options.type) {
        path += '&type=1';
      }
      if (options.ev) {
        path += '&ev=1';
      }

      return connection.get(path);
    }).then((response) => {
      connection.close();

      return new Promise((resolve, reject) => {
        if (response.statusCode === 200 || response.statusCode === 207) {
          resolve(JSON.parse(response.body));
        } else {
          reject(`Get failed with status ${response.statusCode}`);
        }
      });
    });
  }

  /**
   * Modify a set of characteristics.
   *
   * @param {Object} characteristics - Characteristic IDs to set, id -> val
   * @returns {Promise} Promise which resolves to the JSON document.
   */
  setCharacteristics(characteristics) {
    const connection = new HttpConnection(this.address, this.port);
    const data = {
      characteristics: [],
    };

    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      for (const cid in characteristics) {
        const parts = cid.split('.');
        data.characteristics.push({
          aid: parseInt(parts[0], 10),
          iid: parseInt(parts[1], 10),
          value: characteristics[cid],
        });
      }

      return connection.put('/characteristics',
                            Buffer.from(JSON.stringify(data)));
    }).then((response) => {
      connection.close();

      return new Promise((resolve, reject) => {
        if (response.statusCode === 204) {
          resolve(data);
        } else if (response.statusCode === 207) {
          resolve(JSON.parse(response.body));
        } else {
          reject(`Set failed with status ${response.statusCode}`);
        }
      });
    });
  }

  /**
   * Subscribe to events for a set of characteristics.
   *
   * @param {String[]} characteristics - List of characteristic IDs to subscribe
   *                   to
   * @returns {Promise} Promise which resolves to the HttpConnection object.
   */
  subscribeCharacteristics(characteristics) {
    const connection = new HttpConnection(this.address, this.port);
    const data = {
      characteristics: [],
    };

    return this._pairVerify(connection).then((keys) => {
      connection.setSessionKeys(keys);
      for (const cid of characteristics) {
        const parts = cid.split('.');
        data.characteristics.push({
          aid: parseInt(parts[0], 10),
          iid: parseInt(parts[1], 10),
          ev: true,
        });
      }

      connection.on('event', (ev) => {
        this.emit('event', JSON.parse(ev));
      });

      connection.on('disconnect', () => {
        this.emit('disconnect', {});
      });

      return connection.put(
        '/characteristics',
        Buffer.from(JSON.stringify(data)),
        // eslint-disable-next-line no-undefined
        undefined,
        true
      );
    }).then((response) => {
      return new Promise((resolve, reject) => {
        if (response.statusCode === 204 || response.statusCode === 207) {
          resolve(connection);
        } else {
          reject(`Subscribe failed with status ${response.statusCode}`);
        }
      });
    });
  }

  /**
   * Unsubscribe from events for a set of characteristics.
   *
   * @param {String[]} characteristics - List of characteristic IDs to
   *                   unsubscribe from
   * @param {Object} connection - Existing HttpConnection object
   * @returns {Promise} Promise which resolves when the procedure is done.
   */
  unsubscribeCharacteristics(characteristics, connection) {
    const data = {
      characteristics: [],
    };

    for (const cid of characteristics) {
      const parts = cid.split('.');
      data.characteristics.push({
        aid: parseInt(parts[0], 10),
        iid: parseInt(parts[1], 10),
        ev: false,
      });
    }

    return connection.put(
      '/characteristics',
      Buffer.from(JSON.stringify(data))
    ).then((response) => {
      return new Promise((resolve, reject) => {
        if (response.statusCode === 204 || response.statusCode === 207) {
          resolve();
        } else {
          reject(`Unsubscribe failed with status ${response.statusCode}`);
        }
      });
    });
  }
}

module.exports = HttpClient;
