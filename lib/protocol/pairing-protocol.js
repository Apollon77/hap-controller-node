/**
 * Build and parse packets for pairing protocol requests.
 */
'use strict';

const HKDF = require('hkdf');
const TLV = require('../model/tlv');
const sodium = require('libsodium-wrappers');
const srp = require('fast-srp-hap');
const uuid = require('uuid/v4');

const Steps = {
  M1: 1,
  M2: 2,
  M3: 3,
  M4: 4,
  M5: 5,
  M6: 6,
};

/**
 * See Table 4-4, Table 6-27
 */
const Methods = {
  PairSetup: 1,
  PairVerify: 2,
  AddPairing: 3,
  RemovePairing: 4,
  ListPairings: 5,
  PairResume: 6,
};

/**
 * See Table 4-6, Table 6-27
 */
const Types = {
  kTLVType_Method: 0,
  kTLVType_Identifier: 1,
  kTLVType_Salt: 2,
  kTLVType_PublicKey: 3,
  kTLVType_Proof: 4,
  kTLVType_EncryptedData: 5,
  kTLVType_State: 6,
  kTLVType_Error: 7,
  kTLVType_RetryDelay: 8,
  kTLVType_Certificate: 9,
  kTLVType_Signature: 10,
  kTLVType_Permissions: 11,
  kTLVType_FragmentData: 12,
  kTLVType_FragmentLast: 13,
  kTLVType_SessionID: 14,
  kTLVType_Separator: 255,
};

/**
 * See Table 4-5
 */
// eslint-disable-next-line no-unused-vars
const Errors = {
  kTLVError_Unknown: 1,
  kTLVError_Authentication: 2,
  kTLVError_Backoff: 3,
  kTLVError_MaxPeers: 4,
  kTLVError_MaxTries: 5,
  kTLVError_Unavailable: 6,
  kTLVError_Busy: 7,
};

class PairingProtocol {
  /**
   * Create the PairingProtocol object.
   *
   * @param {Object?} pairingData - Optional saved pairing data
   */
  constructor(pairingData = {}) {
    this.AccessoryPairingID = null;
    if (pairingData.AccessoryPairingID) {
      this.AccessoryPairingID =
        PairingProtocol.bufferFromHex(pairingData.AccessoryPairingID);
    }

    this.AccessoryLTPK = null;
    if (pairingData.AccessoryLTPK) {
      this.AccessoryLTPK =
        PairingProtocol.bufferFromHex(pairingData.AccessoryLTPK);
    }

    this.iOSDevicePairingID = null;
    if (pairingData.iOSDevicePairingID) {
      this.iOSDevicePairingID =
        PairingProtocol.bufferFromHex(pairingData.iOSDevicePairingID);
    }

    this.iOSDeviceLTSK = null;
    if (pairingData.iOSDeviceLTSK) {
      this.iOSDeviceLTSK =
        PairingProtocol.bufferFromHex(pairingData.iOSDeviceLTSK);
    }

    this.iOSDeviceLTPK = null;
    if (pairingData.iOSDeviceLTPK) {
      this.iOSDeviceLTPK =
        PairingProtocol.bufferFromHex(pairingData.iOSDeviceLTPK);
    }

    this.srpClient = null;

    this.pairSetup = {
      sessionKey: null,
    };

    this.pairVerify = {
      privateKey: null,
      publicKey: null,
      sessionKey: null,
      sharedSecret: null,
      accessoryPublicKey: null,
      sessionID: null,
    };

    this.sessionKeys = {
      accessoryToControllerKey: null,
      controllerToAccessoryKey: null,
    };
  }

  /**
   * Parse a buffer from a hex string.
   */
  static bufferFromHex(buf) {
    if (typeof buf === 'string') {
      return Buffer.from(buf, 'hex');
    }

    return buf;
  }

  /**
   * Convert a buffer to a hex string.
   */
  static bufferToHex(buf) {
    if (buf) {
      return buf.toString('hex');
    }

    return buf;
  }

  /**
   * Determine whether or not we can use pair resume.
   *
   * @returns {boolean} Boolean indicating if pair resume is possible.
   */
  canResume() {
    return Buffer.isBuffer(this.pairVerify.sessionID);
  }

  /**
   * Build step 1 of the pair setup process.
   *
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildPairSetupM1() {
    const packet = TLV.encodeObject({
      [Types.kTLVType_State]: Buffer.from([Steps.M1]),
      [Types.kTLVType_Method]: Buffer.from([Methods.PairSetup]),
    });
    return Promise.resolve(packet);
  }

  /**
   * Parse step 2 of the pair setup process.
   *
   * @param {Buffer} m2Buffer - Buffer containing M2 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parsePairSetupM2(m2Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m2Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M2: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M2) {
        reject(`M2: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      resolve(tlv);
    });
  }

  /**
   * Build step 3 of the pair setup process.
   *
   * @param {Object} m2Tlv - TLV object containing M2 response
   * @param {string} pin - Setup PIN
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildPairSetupM3(m2Tlv, pin) {
    return new Promise((resolve) => {
      srp.genKey(32, (err, key) => {
        this.srpClient = new srp.Client(
          srp.params['3072'],
          m2Tlv[Types.kTLVType_Salt],
          Buffer.from('Pair-Setup'),
          Buffer.from(pin),
          key
        );
        this.srpClient.setB(m2Tlv[Types.kTLVType_PublicKey]);

        const packet = TLV.encodeObject({
          [Types.kTLVType_State]: Buffer.from([Steps.M3]),
          [Types.kTLVType_PublicKey]: this.srpClient.computeA(),
          [Types.kTLVType_Proof]: this.srpClient.computeM1(),
        });

        resolve(packet);
      });
    });
  }

  /**
   * Parse step 4 of the pair setup process.
   *
   * @param {Buffer} m4Buffer - Buffer containing M4 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parsePairSetupM4(m4Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m4Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M4: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M4) {
        reject(`M4: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      if (!tlv[Types.kTLVType_Proof]) {
        reject('M4: Proof missing from TLV');
        return;
      }

      try {
        this.srpClient.checkM2(tlv[Types.kTLVType_Proof]);
      } catch (e) {
        reject('M4: Proof verification failed');
        return;
      }

      resolve(tlv);
    });
  }

  /**
   * Build step 5 of the pair setup process.
   *
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildPairSetupM5() {
    return new Promise((resolve) => {
      const seed = Buffer.from(sodium.randombytes_buf(32));

      const key = sodium.crypto_sign_seed_keypair(seed);
      this.iOSDeviceLTSK = Buffer.from(key.privateKey);
      this.iOSDeviceLTPK = Buffer.from(key.publicKey);

      new HKDF(
        'sha512',
        'Pair-Setup-Controller-Sign-Salt',
        this.srpClient.computeK()
      ).derive('Pair-Setup-Controller-Sign-Info', 32, (key) => {
        const iOSDeviceX = key;
        this.iOSDevicePairingID = Buffer.from(uuid());
        const iOSDeviceInfo = Buffer.concat([
          iOSDeviceX,
          this.iOSDevicePairingID,
          this.iOSDeviceLTPK,
        ]);
        const iOSDeviceSignature = Buffer.from(
          sodium.crypto_sign_detached(
            iOSDeviceInfo,
            this.iOSDeviceLTSK
          )
        );

        const subTlv = TLV.encodeObject({
          [Types.kTLVType_Identifier]: this.iOSDevicePairingID,
          [Types.kTLVType_PublicKey]: this.iOSDeviceLTPK,
          [Types.kTLVType_Signature]: iOSDeviceSignature,
        });

        new HKDF(
          'sha512',
          'Pair-Setup-Encrypt-Salt',
          this.srpClient.computeK()
        ).derive('Pair-Setup-Encrypt-Info', 32, (sessionKey) => {
          this.pairSetup.sessionKey = sessionKey;

          const encryptedData = Buffer.from(
            sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
              subTlv,
              null,
              null,
              Buffer.concat([Buffer.from([0, 0, 0, 0]),
                             Buffer.from('PS-Msg05')]),
              this.pairSetup.sessionKey
            )
          );

          const tlv = TLV.encodeObject({
            [Types.kTLVType_State]: Buffer.from([Steps.M5]),
            [Types.kTLVType_EncryptedData]: encryptedData,
          });

          resolve(tlv);
        });
      });
    });
  }

  /**
   * Parse step 6 of the pair setup process.
   *
   * @param {Buffer} m6Buffer - Buffer containing M4 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parsePairSetupM6(m6Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m6Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M6: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M6) {
        reject(`M6: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      if (!tlv[Types.kTLVType_EncryptedData]) {
        reject('M6: Encrypted data missing from TLV');
        return;
      }

      let decryptedData;
      try {
        decryptedData = Buffer.from(
          sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
            null,
            tlv[Types.kTLVType_EncryptedData],
            null,
            Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PS-Msg06')]),
            this.pairSetup.sessionKey
          )
        );
      } catch (_e) {
        reject('M6: Decryption of sub-TLV failed');
        return;
      }

      const subTlv = TLV.decodeBuffer(decryptedData);

      if (!subTlv[Types.kTLVType_Signature]) {
        reject('M6: Signature missing from sub-TLV');
        return;
      }

      if (!subTlv[Types.kTLVType_Identifier]) {
        reject('M6: Identifier missing from sub-TLV');
        return;
      }

      if (!subTlv[Types.kTLVType_PublicKey]) {
        reject('M6: Public key missing from sub-TLV');
        return;
      }

      new HKDF(
        'sha512',
        'Pair-Setup-Accessory-Sign-Salt',
        this.srpClient.computeK()
      ).derive('Pair-Setup-Accessory-Sign-Info', 32, (key) => {
        const AccessoryX = key;
        this.AccessoryPairingID = subTlv[Types.kTLVType_Identifier];
        this.AccessoryLTPK = subTlv[Types.kTLVType_PublicKey];
        const AccessorySignature = subTlv[Types.kTLVType_Signature];
        const AccessoryInfo = Buffer.concat([
          AccessoryX,
          this.AccessoryPairingID,
          this.AccessoryLTPK,
        ]);

        if (sodium.crypto_sign_verify_detached(AccessorySignature,
                                               AccessoryInfo,
                                               this.AccessoryLTPK)) {
          resolve(subTlv);
        } else {
          reject('M6: Signature verification failed');
        }
      });
    });
  }

  /**
   * Build step 1 of the pair verify process.
   *
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildPairVerifyM1() {
    this.pairVerify.privateKey = Buffer.from(sodium.randombytes_buf(32));

    this.pairVerify.publicKey = Buffer.from(
      sodium.crypto_scalarmult_base(this.pairVerify.privateKey)
    );

    const packet = TLV.encodeObject({
      [Types.kTLVType_State]: Buffer.from([Steps.M1]),
      [Types.kTLVType_PublicKey]: this.pairVerify.publicKey,
    });

    return Promise.resolve(packet);
  }

  /**
   * Parse step 2 of the pair verify process.
   *
   * @param {Buffer} m2Buffer - Buffer containing M2 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parsePairVerifyM2(m2Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m2Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M2: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M2) {
        reject(`M2: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      if (!tlv[Types.kTLVType_PublicKey]) {
        reject('M2: Public key missing from TLV');
        return;
      }

      if (!tlv[Types.kTLVType_EncryptedData]) {
        reject('M2: Encrypted data missing from TLV');
        return;
      }

      this.pairVerify.accessoryPublicKey = tlv[Types.kTLVType_PublicKey];

      this.pairVerify.sharedSecret = Buffer.from(
        sodium.crypto_scalarmult(
          this.pairVerify.privateKey,
          this.pairVerify.accessoryPublicKey
        )
      );

      new HKDF(
        'sha512',
        'Pair-Verify-Encrypt-Salt',
        this.pairVerify.sharedSecret
      ).derive('Pair-Verify-Encrypt-Info', 32, (sessionKey) => {
        this.pairVerify.sessionKey = sessionKey;

        new HKDF(
          'sha512',
          'Pair-Verify-Resume-Salt',
          this.pairVerify.sharedSecret
        ).derive('Pair-Verify-Resume-Info', 8, (sessionID) => {
          this.pairVerify.sessionID = sessionID;

          let decryptedData;
          try {
            decryptedData = Buffer.from(
              sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                null,
                tlv[Types.kTLVType_EncryptedData],
                null,
                Buffer.concat([Buffer.from([0, 0, 0, 0]),
                               Buffer.from('PV-Msg02')]),
                this.pairVerify.sessionKey
              )
            );
          } catch (_e) {
            reject('M2: Decryption of sub-TLV failed');
            return;
          }

          const subTlv = TLV.decodeBuffer(decryptedData);

          if (!subTlv[Types.kTLVType_Signature]) {
            reject('M2: Signature missing from sub-TLV');
            return;
          }

          if (!subTlv[Types.kTLVType_Identifier]) {
            reject('M2: Identifier missing from sub-TLV');
            return;
          }

          const AccessoryPairingID =
            subTlv[Types.kTLVType_Identifier].toString();
          if (AccessoryPairingID !== this.AccessoryPairingID.toString()) {
            reject('M2: Wrong accessory pairing ID');
            return;
          }

          const AccessoryInfo = Buffer.concat([
            this.pairVerify.accessoryPublicKey,
            this.AccessoryPairingID,
            Buffer.from(
              sodium.crypto_scalarmult_base(this.pairVerify.privateKey)),
          ]);

          const signature = subTlv[Types.kTLVType_Signature];
          if (sodium.crypto_sign_verify_detached(signature,
                                                 AccessoryInfo,
                                                 this.AccessoryLTPK)) {
            resolve(subTlv);
          } else {
            reject('M2: Signature verification failed');
          }
        });
      });
    });
  }

  /**
   * Build step 3 of the pair verify process.
   *
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildPairVerifyM3() {
    const iOSDeviceInfo = Buffer.concat([
      this.pairVerify.publicKey,
      this.iOSDevicePairingID,
      this.pairVerify.accessoryPublicKey,
    ]);

    const iOSDeviceSignature = Buffer.from(
      sodium.crypto_sign_detached(iOSDeviceInfo, this.iOSDeviceLTSK)
    );

    const subTlv = TLV.encodeObject({
      [Types.kTLVType_Identifier]: Buffer.from(this.iOSDevicePairingID),
      [Types.kTLVType_Signature]: iOSDeviceSignature,
    });

    const encryptedData = Buffer.from(
      sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
        subTlv,
        null,
        null,
        Buffer.concat([Buffer.from([0, 0, 0, 0]),
                       Buffer.from('PV-Msg03')]),
        this.pairVerify.sessionKey
      )
    );

    const tlv = TLV.encodeObject({
      [Types.kTLVType_State]: Buffer.from([Steps.M3]),
      [Types.kTLVType_EncryptedData]: encryptedData,
    });

    return Promise.resolve(tlv);
  }

  /**
   * Parse step 4 of the pair verify process.
   *
   * @param {Buffer} m4Buffer - Buffer containing M4 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parsePairVerifyM4(m4Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m4Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M4: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M4) {
        reject(`M4: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      resolve(tlv);
    });
  }

  /**
   * Get the session keys generated by the PairVerify process.
   *
   * @returns {Promise} Promise which resolves to an object:
   *   {
   *     AccessoryToControllerKey: {Buffer},
   *     ControllerToAccessoryKey: {Buffer},
   *   }
   */
  getSessionKeys() {
    return new Promise((resolve) => {
      const salt = new HKDF(
        'sha512',
        'Control-Salt',
        this.pairVerify.sharedSecret
      );

      salt.derive('Control-Write-Encryption-Key', 32, (key) => {
        this.sessionKeys.controllerToAccessoryKey = key;

        salt.derive('Control-Read-Encryption-Key', 32, (key) => {
          this.sessionKeys.accessoryToControllerKey = key;

          resolve({
            AccessoryToControllerKey: this.sessionKeys.accessoryToControllerKey,
            ControllerToAccessoryKey: this.sessionKeys.controllerToAccessoryKey,
          });
        });
      });
    });
  }

  /**
   * Build step 1 of the add pairing process.
   *
   * @param {string} identifier - Identifier of the new controller
   * @param {Buffer} ltpk - Long-term public key of the new controller
   * @param {boolean} isAdmin - Whether or not the new controller is an admin
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildAddPairingM1(identifier, ltpk, isAdmin) {
    const packet = TLV.encodeObject({
      [Types.kTLVType_State]: Buffer.from([Steps.M1]),
      [Types.kTLVType_Method]: Buffer.from([Methods.AddPairing]),
      [Types.kTLVType_Identifier]: Buffer.from(identifier),
      [Types.kTLVType_PublicKey]: ltpk,
      [Types.kTLVType_Permissions]: Buffer.from([isAdmin ? 1 : 0]),
    });
    return Promise.resolve(packet);
  }

  /**
   * Parse step 2 of the add pairing process.
   *
   * @param {Buffer} m2Buffer - Buffer containing M2 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parseAddPairingM2(m2Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m2Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M2: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M2) {
        reject(`M2: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      resolve(tlv);
    });
  }

  /**
   * Build step 1 of the remove pairing process.
   *
   * @param {string} identifier - Identifier of the controller to remove
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildRemovePairingM1(identifier) {
    const packet = TLV.encodeObject({
      [Types.kTLVType_State]: Buffer.from([Steps.M1]),
      [Types.kTLVType_Method]: Buffer.from([Methods.RemovePairing]),
      [Types.kTLVType_Identifier]: Buffer.from(identifier),
    });
    return Promise.resolve(packet);
  }

  /**
   * Parse step 2 of the remove pairing process.
   *
   * @param {Buffer} m2Buffer - Buffer containing M2 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parseRemovePairingM2(m2Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m2Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M2: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M2) {
        reject(`M2: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      resolve(tlv);
    });
  }

  /**
   * Build step 1 of the list pairings process.
   *
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildListPairingsM1() {
    const packet = TLV.encodeObject({
      [Types.kTLVType_State]: Buffer.from([Steps.M1]),
      [Types.kTLVType_Method]: Buffer.from([Methods.ListPairings]),
    });
    return Promise.resolve(packet);
  }

  /**
   * Parse step 2 of the list pairings process.
   *
   * @param {Buffer} m2Buffer - Buffer containing M2 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parseListPairingsM2(m2Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m2Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M2: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M2) {
        reject(`M2: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      resolve(tlv);
    });
  }

  /**
   * Build step 1 of the pair resume process.
   *
   * @returns {Promise} Promise which resolves to a Buffer.
   */
  buildPairResumeM1() {
    return new Promise((resolve) => {
      this.pairVerify.privateKey = Buffer.from(sodium.randombytes_buf(32));

      this.pairVerify.publicKey = Buffer.from(
        sodium.crypto_scalarmult_base(this.pairVerify.privateKey)
      );

      new HKDF(
        'sha512',
        Buffer.concat([this.pairVerify.publicKey, this.pairVerify.sessionID]),
        this.pairVerify.sharedSecret
      ).derive('Pair-Resume-Request-Info', 32, (requestKey) => {
        const encryptedData = Buffer.from(
          sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
            Buffer.alloc(0),
            null,
            null,
            Buffer.concat([Buffer.from([0, 0, 0, 0]),
                           Buffer.from('PR-Msg01')]),
            requestKey
          )
        );

        const packet = TLV.encodeObject({
          [Types.kTLVType_State]: Buffer.from([Steps.M1]),
          [Types.kTLVType_Method]: Buffer.from([Methods.PairResume]),
          [Types.kTLVType_PublicKey]: this.pairVerify.publicKey,
          [Types.kTLVType_SessionID]: this.pairVerify.sessionID,
          [Types.kTLVType_EncryptedData]: encryptedData,
        });

        resolve(packet);
      });
    });
  }

  /**
   * Parse step 2 of the pair resume process.
   *
   * @param {Buffer} m2Buffer - Buffer containing M2 response
   * @returns {Promise} Promise which resolves to a TLV object.
   */
  parsePairResumeM2(m2Buffer) {
    return new Promise((resolve, reject) => {
      const tlv = TLV.decodeBuffer(m2Buffer);

      if (tlv[Types.kTLVType_Error]) {
        reject(`M2: Error: ${tlv[Types.kTLVType_Error].readUInt8(0)}`);
        return;
      }

      if (tlv[Types.kTLVType_State][0] !== Steps.M2) {
        reject(`M2: Invalid state: ${tlv[Types.kTLVType_State][0]}`);
        return;
      }

      if (!tlv[Types.kTLVType_SessionID]) {
        reject('M2: Session ID missing from TLV');
        return;
      }

      if (!tlv[Types.kTLVType_EncryptedData]) {
        reject('M2: Encrypted data missing from TLV');
        return;
      }

      this.pairVerify.sessionID = tlv[Types.kTLVType_SessionID];

      new HKDF(
        'sha512',
        Buffer.concat([this.pairVerify.publicKey, this.pairVerify.sessionID]),
        this.pairVerify.sharedSecret
      ).derive('Pair-Resume-Response-Info', 32, (responseKey) => {
        try {
          sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
            null,
            tlv[Types.kTLVType_EncryptedData],
            null,
            Buffer.concat([Buffer.from([0, 0, 0, 0]),
                           Buffer.from('PR-Msg02')]),
            responseKey
          );
        } catch (_e) {
          reject('M2: Decryption of data failed');
          return;
        }

        new HKDF(
          'sha512',
          Buffer.concat([this.pairVerify.publicKey, this.pairVerify.sessionID]),
          this.pairVerify.sharedSecret
        ).derive('Pair-Resume-Shared-Secret-Info', 32, (sharedSecret) => {
          this.pairVerify.sharedSecret = sharedSecret;
          resolve(tlv);
        });
      });
    });
  }

  /**
   * Get the data (keys) that needs to be stored long-term.
   *
   * @returns {Object} Object containing the keys that should be stored.
   */
  getLongTermData() {
    return {
      AccessoryPairingID: PairingProtocol.bufferToHex(this.AccessoryPairingID),
      AccessoryLTPK: PairingProtocol.bufferToHex(this.AccessoryLTPK),
      iOSDevicePairingID: PairingProtocol.bufferToHex(this.iOSDevicePairingID),
      iOSDeviceLTSK: PairingProtocol.bufferToHex(this.iOSDeviceLTSK),
      iOSDeviceLTPK: PairingProtocol.bufferToHex(this.iOSDeviceLTPK),
    };
  }
}

module.exports = PairingProtocol;
