/**
 * Build and parse packets for pairing protocol requests.
 */

import { decodeBuffer, encodeObject, TLV } from '../model/tlv';
import sodium from 'libsodium-wrappers';
import { v4 as uuidv4 } from 'uuid';
import { SRP, SrpClient } from 'fast-srp-hap';
import HKDF from 'node-hkdf-sync';

const Steps = {
    M1: 1,
    M2: 2,
    M3: 3,
    M4: 4,
    M5: 5,
    M6: 6,
};

/**
 * See Table 5-3, Table 7-38
 */
const Methods = {
    PairSetup: 0,
    PairSetupWithAuth: 1,
    PairVerify: 2,
    AddPairing: 3,
    RemovePairing: 4,
    ListPairings: 5,
    PairResume: 6,
};

const PairMethods = {
    PairSetup: Methods.PairSetup,
    PairSetupWithAuth: Methods.PairSetupWithAuth,
};

/**
 * See Table 5-5
 */

export const ErrorCodes = {
    kTLVError_Unknown: 0x01,
    kTLVError_Authentication: 0x02,
    kTLVError_Backoff: 0x03,
    kTLVError_MaxPeers: 0x04,
    kTLVError_MaxTries: 0x05,
    kTLVError_Unavailable: 0x06,
    kTLVError_Busy: 0x07,
};

/**
 * See Table 5-6, Table 7-38
 */
export const Types = {
    kTLVType_Method: 0x00,
    kTLVType_Identifier: 0x01,
    kTLVType_Salt: 0x02,
    kTLVType_PublicKey: 0x03,
    kTLVType_Proof: 0x04,
    kTLVType_EncryptedData: 0x05,
    kTLVType_State: 0x06,
    kTLVType_Error: 0x07,
    kTLVType_RetryDelay: 0x08,
    kTLVType_Certificate: 0x09,
    kTLVType_Signature: 0x0a,
    kTLVType_Permissions: 0x0b,
    kTLVType_FragmentData: 0x0c,
    kTLVType_FragmentLast: 0x0d,
    kTLVType_SessionID: 0x0e,
    kTLVType_Flags: 0x13,
    kTLVType_Separator: 0xff,
};

/**
 * See Table 5-7
 */
const PairingTypeFlags = {
    kPairingFlag_Transient: 0x00000010,
    kPairingFlag_Split: 0x01000000,
};
export { PairMethods, PairingTypeFlags };

export interface SessionKeys {
    AccessoryToControllerKey: Buffer;
    ControllerToAccessoryKey: Buffer;
}

export interface PairingData {
    AccessoryPairingID: string;
    AccessoryLTPK: string;
    iOSDevicePairingID: string;
    iOSDeviceLTSK: string;
    iOSDeviceLTPK: string;
}

export default class PairingProtocol {
    private AccessoryPairingID: Buffer | null;

    private AccessoryLTPK: Buffer | null;

    private iOSDevicePairingID: Buffer | null;

    private iOSDeviceLTSK: Buffer | null;

    private iOSDeviceLTPK: Buffer | null;

    private pairSetup: {
        sessionKey: Buffer | null;
    };

    private pairVerify: {
        privateKey: Buffer | null;
        publicKey: Buffer | null;
        sessionKey: Buffer | null;
        sharedSecret: Buffer | null;
        accessoryPublicKey: Buffer | null;
        sessionID: Buffer | null;
    };

    private sessionKeys: {
        accessoryToControllerKey: Buffer | null;
        controllerToAccessoryKey: Buffer | null;
    };

    private srpClient: SrpClient | null;

    /**
     * Create the PairingProtocol object.
     *
     * @param {Object?} pairingData - Optional saved pairing data
     */
    constructor(pairingData?: PairingData) {
        this.AccessoryPairingID = null;
        if (pairingData?.AccessoryPairingID) {
            this.AccessoryPairingID = PairingProtocol.bufferFromHex(pairingData.AccessoryPairingID);
        }

        this.AccessoryLTPK = null;
        if (pairingData?.AccessoryLTPK) {
            this.AccessoryLTPK = PairingProtocol.bufferFromHex(pairingData.AccessoryLTPK);
        }

        this.iOSDevicePairingID = null;
        if (pairingData?.iOSDevicePairingID) {
            this.iOSDevicePairingID = PairingProtocol.bufferFromHex(pairingData.iOSDevicePairingID);
        }

        this.iOSDeviceLTSK = null;
        if (pairingData?.iOSDeviceLTSK) {
            this.iOSDeviceLTSK = PairingProtocol.bufferFromHex(pairingData.iOSDeviceLTSK);
        }

        this.iOSDeviceLTPK = null;
        if (pairingData?.iOSDeviceLTPK) {
            this.iOSDeviceLTPK = PairingProtocol.bufferFromHex(pairingData.iOSDeviceLTPK);
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
    static bufferFromHex(buf: string): Buffer {
        if (typeof buf === 'string') {
            return Buffer.from(buf, 'hex');
        }

        return buf;
    }

    /**
     * Convert a buffer to a hex string.
     */
    static bufferToHex(buf: Buffer): string {
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
    canResume(): boolean {
        return Buffer.isBuffer(this.pairVerify.sessionID);
    }

    /**
     * Build step 1 of the pair setup process.
     *
     * @param {PairMethods} [pairMethod] - Method to use for pairing, default is PairSetupWithAuth
     * @param {PairingTypeFlags} [pairFlags] - Flags to use for Pairing for PairSetup
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildPairSetupM1(pairMethod = PairMethods.PairSetupWithAuth, pairFlags = 0): Promise<Buffer> {
        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M1]));
        data.set(Types.kTLVType_Method, Buffer.from([pairMethod]));
        if (pairMethod === PairMethods.PairSetup && pairFlags) {
            data.set(Types.kTLVType_Flags, Buffer.from([pairFlags]));
        }
        const packet = encodeObject(data);
        return packet;
    }

    /**
     * Parse step 2 of the pair setup process.
     *
     * @param {Buffer} m2Buffer - Buffer containing M2 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parsePairSetupM2(m2Buffer: Buffer): Promise<TLV> {
        const tlv = decodeBuffer(m2Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M2: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M2: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M2: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M2) {
            throw new Error(`M2: Invalid state: ${state}`);
        }

        if (!tlv.has(Types.kTLVType_PublicKey)) {
            throw new Error('M2: Missing public key');
        }

        if (!tlv.has(Types.kTLVType_Salt)) {
            throw new Error('M2: Missing salt');
        }

        return tlv;
    }

    /**
     * Build step 3 of the pair setup process.
     *
     * @param {Object} m2Tlv - TLV object containing M2 response
     * @param {string} pin - Setup PIN
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildPairSetupM3(m2Tlv: TLV, pin: string): Promise<Buffer> {
        const key = await SRP.genKey(32);

        this.srpClient = new SrpClient(
            SRP.params.hap,
            m2Tlv.get(Types.kTLVType_Salt)!,
            Buffer.from('Pair-Setup'),
            Buffer.from(pin),
            key
        );
        this.srpClient.setB(m2Tlv.get(Types.kTLVType_PublicKey)!);

        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M3]));
        data.set(Types.kTLVType_PublicKey, this.srpClient.computeA());
        data.set(Types.kTLVType_Proof, this.srpClient.computeM1());
        return encodeObject(data);
    }

    /**
     * Parse step 4 of the pair setup process.
     *
     * @param {Buffer} m4Buffer - Buffer containing M4 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parsePairSetupM4(m4Buffer: Buffer): Promise<TLV> {
        if (!this.srpClient) {
            throw new Error('M4: SRP client not yet created');
        }

        const tlv = decodeBuffer(m4Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M4: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M4: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M4: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M4) {
            throw new Error(`M4: Invalid state: ${state}`);
        }

        if (!tlv.has(Types.kTLVType_Proof)) {
            throw new Error('M4: Proof missing from TLV');
        }

        try {
            this.srpClient!.checkM2(tlv.get(Types.kTLVType_Proof)!);
        } catch (e) {
            throw new Error(`M4: Proof verification failed: ${e}`);
        }

        return tlv;
    }

    /**
     * Build step 5 of the pair setup process.
     *
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildPairSetupM5(): Promise<Buffer> {
        if (!this.srpClient) {
            throw new Error('M5: SRP client not yet created');
        }

        await sodium.ready;

        const seed = Buffer.from(sodium.randombytes_buf(32));

        const key = sodium.crypto_sign_seed_keypair(seed);
        this.iOSDeviceLTSK = Buffer.from(key.privateKey);
        this.iOSDeviceLTPK = Buffer.from(key.publicKey);

        const hkdf1 = new HKDF('sha512', 'Pair-Setup-Controller-Sign-Salt', this.srpClient!.computeK());
        const iOSDeviceX = hkdf1.derive('Pair-Setup-Controller-Sign-Info', 32);

        this.iOSDevicePairingID = Buffer.from(uuidv4());
        const iOSDeviceInfo = Buffer.concat([iOSDeviceX, this.iOSDevicePairingID, this.iOSDeviceLTPK!]);
        const iOSDeviceSignature = Buffer.from(sodium.crypto_sign_detached(iOSDeviceInfo, this.iOSDeviceLTSK!));

        const subData = new Map();
        subData.set(Types.kTLVType_Identifier, this.iOSDevicePairingID);
        subData.set(Types.kTLVType_PublicKey, this.iOSDeviceLTPK);
        subData.set(Types.kTLVType_Signature, iOSDeviceSignature);
        const subTlv = encodeObject(subData);

        const hkdf2 = new HKDF('sha512', 'Pair-Setup-Encrypt-Salt', this.srpClient!.computeK());
        this.pairSetup.sessionKey = hkdf2.derive('Pair-Setup-Encrypt-Info', 32);

        const encryptedData = Buffer.from(
            sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
                subTlv,
                null,
                null,
                Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PS-Msg05')]),
                this.pairSetup.sessionKey!
            )
        );

        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M5]));
        data.set(Types.kTLVType_EncryptedData, encryptedData);
        const tlv = encodeObject(data);

        return tlv;
    }

    /**
     * Parse step 6 of the pair setup process.
     *
     * @param {Buffer} m6Buffer - Buffer containing M4 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parsePairSetupM6(m6Buffer: Buffer): Promise<TLV> {
        if (!this.srpClient) {
            throw new Error('M5: SRP client not yet created');
        }

        if (!this.pairSetup.sessionKey) {
            throw new Error('M6: Session key not yet set');
        }

        await sodium.ready;

        const tlv = decodeBuffer(m6Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M6: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M6: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M6: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M6) {
            throw new Error(`M6: Invalid state: ${state}`);
        }

        if (!tlv.has(Types.kTLVType_EncryptedData)) {
            throw new Error('M6: Encrypted data missing from TLV');
        }

        let decryptedData;
        try {
            decryptedData = Buffer.from(
                sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                    null,
                    tlv.get(Types.kTLVType_EncryptedData)!,
                    null,
                    Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PS-Msg06')]),
                    this.pairSetup.sessionKey!
                )
            );
        } catch (_e) {
            throw new Error('M6: Decryption of sub-TLV failed');
        }

        const subTlv = decodeBuffer(decryptedData);

        if (!subTlv.has(Types.kTLVType_Signature)) {
            throw new Error('M6: Signature missing from sub-TLV');
        }

        if (!subTlv.has(Types.kTLVType_Identifier)) {
            throw new Error('M6: Identifier missing from sub-TLV');
        }

        if (!subTlv.has(Types.kTLVType_PublicKey)) {
            throw new Error('M6: Public key missing from sub-TLV');
        }

        const hkdf = new HKDF('sha512', 'Pair-Setup-Accessory-Sign-Salt', this.srpClient!.computeK());
        const AccessoryX = hkdf.derive('Pair-Setup-Accessory-Sign-Info', 32);

        this.AccessoryPairingID = subTlv.get(Types.kTLVType_Identifier)!;
        this.AccessoryLTPK = subTlv.get(Types.kTLVType_PublicKey)!;
        const AccessorySignature = subTlv.get(Types.kTLVType_Signature)!;
        const AccessoryInfo = Buffer.concat([AccessoryX, this.AccessoryPairingID, this.AccessoryLTPK]);

        if (sodium.crypto_sign_verify_detached(AccessorySignature, AccessoryInfo, this.AccessoryLTPK)) {
            return subTlv;
        } else {
            throw new Error('M6: Signature verification failed');
        }
    }

    /**
     * Build step 1 of the pair verify process.
     *
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildPairVerifyM1(): Promise<Buffer> {
        await sodium.ready;

        this.pairVerify.privateKey = Buffer.from(sodium.randombytes_buf(32));

        this.pairVerify.publicKey = Buffer.from(sodium.crypto_scalarmult_base(this.pairVerify.privateKey));

        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M1]));
        data.set(Types.kTLVType_PublicKey, this.pairVerify.publicKey);
        const packet = encodeObject(data);

        return packet;
    }

    /**
     * Parse step 2 of the pair verify process.
     *
     * @param {Buffer} m2Buffer - Buffer containing M2 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parsePairVerifyM2(m2Buffer: Buffer): Promise<TLV> {
        if (!this.AccessoryLTPK) {
            throw new Error('M2: Accessory LTPK not yet set');
        }

        if (!this.pairVerify.privateKey) {
            throw new Error('M2: Private key not yet set');
        }

        await sodium.ready;

        const tlv = decodeBuffer(m2Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M2: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M2: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M2: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M2) {
            throw new Error(`M2: Invalid state: ${state}`);
        }

        if (!tlv.has(Types.kTLVType_PublicKey)) {
            throw new Error('M2: Public key missing from TLV');
        }

        if (!tlv.has(Types.kTLVType_EncryptedData)) {
            throw new Error('M2: Encrypted data missing from TLV');
        }

        this.pairVerify.accessoryPublicKey = tlv.get(Types.kTLVType_PublicKey)!;

        this.pairVerify.sharedSecret = Buffer.from(
            sodium.crypto_scalarmult(this.pairVerify.privateKey!, this.pairVerify.accessoryPublicKey)
        );

        const hkdf1 = new HKDF('sha512', 'Pair-Verify-Encrypt-Salt', this.pairVerify.sharedSecret);
        this.pairVerify.sessionKey = hkdf1.derive('Pair-Verify-Encrypt-Info', 32);

        const hkdf2 = new HKDF('sha512', 'Pair-Verify-Resume-Salt', this.pairVerify.sharedSecret!);
        this.pairVerify.sessionID = hkdf2.derive('Pair-Verify-Resume-Info', 8);

        let decryptedData;
        try {
            decryptedData = Buffer.from(
                sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                    null,
                    tlv.get(Types.kTLVType_EncryptedData)!,
                    null,
                    Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PV-Msg02')]),
                    this.pairVerify.sessionKey!
                )
            );
        } catch (_e) {
            throw new Error('M2: Decryption of sub-TLV failed');
        }

        const subTlv = decodeBuffer(decryptedData);

        if (!subTlv.has(Types.kTLVType_Signature)) {
            throw new Error('M2: Signature missing from sub-TLV');
        }

        if (!subTlv.has(Types.kTLVType_Identifier)) {
            throw new Error('M2: Identifier missing from sub-TLV');
        }

        const AccessoryPairingID = subTlv.get(Types.kTLVType_Identifier)!.toString();
        if (AccessoryPairingID !== this.AccessoryPairingID?.toString()) {
            throw new Error('M2: Wrong accessory pairing ID');
        }

        const AccessoryInfo = Buffer.concat([
            this.pairVerify.accessoryPublicKey!,
            this.AccessoryPairingID,
            Buffer.from(sodium.crypto_scalarmult_base(this.pairVerify.privateKey!)),
        ]);

        const signature = subTlv.get(Types.kTLVType_Signature)!;
        if (sodium.crypto_sign_verify_detached(signature, AccessoryInfo, this.AccessoryLTPK!)) {
            return subTlv;
        } else {
            throw new Error('M2: Signature verification failed');
        }
    }

    /**
     * Build step 3 of the pair verify process.
     *
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildPairVerifyM3(): Promise<Buffer> {
        await sodium.ready;

        if (!this.pairVerify.publicKey) {
            throw new Error('M3: Public key not yet set');
        }

        if (!this.pairVerify.accessoryPublicKey) {
            throw new Error('M3: Accessory public key not yet set');
        }

        if (!this.pairVerify.sessionID) {
            throw new Error('M3: Session ID not yet set');
        }

        if (!this.iOSDevicePairingID) {
            throw new Error('M3: iOS device pairing ID not yet set');
        }

        if (!this.iOSDeviceLTSK) {
            throw new Error('M3: iOS device LTSK not yet set');
        }

        const iOSDeviceInfo = Buffer.concat([
            this.pairVerify.publicKey,
            this.iOSDevicePairingID,
            this.pairVerify.accessoryPublicKey,
        ]);

        const iOSDeviceSignature = Buffer.from(sodium.crypto_sign_detached(iOSDeviceInfo, this.iOSDeviceLTSK));

        const subData = new Map();
        subData.set(Types.kTLVType_Identifier, Buffer.from(this.iOSDevicePairingID));
        subData.set(Types.kTLVType_Signature, iOSDeviceSignature);
        const subTlv = encodeObject(subData);

        const encryptedData = Buffer.from(
            sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
                subTlv,
                null,
                null,
                Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PV-Msg03')]),
                this.pairVerify.sessionKey!
            )
        );

        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M3]));
        data.set(Types.kTLVType_EncryptedData, encryptedData);
        const tlv = encodeObject(data);

        return tlv;
    }

    /**
     * Parse step 4 of the pair verify process.
     *
     * @param {Buffer} m4Buffer - Buffer containing M4 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parsePairVerifyM4(m4Buffer: Buffer): Promise<TLV> {
        const tlv = decodeBuffer(m4Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M4: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M4: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M4: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M4) {
            throw new Error(`M4: Invalid state: ${state}`);
        }

        return tlv;
    }

    /**
     * Get the session keys generated by the PairVerify process.
     *
     * @returns {Object}
     *   {
     *     AccessoryToControllerKey: {Buffer},
     *     ControllerToAccessoryKey: {Buffer},
     *   }
     */
    getSessionKeys(): SessionKeys {
        if (!this.pairVerify.sharedSecret) {
            throw new Error('Shared secret not yet set');
        }

        const salt = new HKDF('sha512', 'Control-Salt', this.pairVerify.sharedSecret!);

        this.sessionKeys.controllerToAccessoryKey = salt.derive('Control-Write-Encryption-Key', 32);
        this.sessionKeys.accessoryToControllerKey = salt.derive('Control-Read-Encryption-Key', 32);

        return {
            AccessoryToControllerKey: this.sessionKeys.accessoryToControllerKey!,
            ControllerToAccessoryKey: this.sessionKeys.controllerToAccessoryKey!,
        };
    }

    /**
     * Build step 1 of the add pairing process.
     *
     * @param {string} identifier - Identifier of the new controller
     * @param {Buffer} ltpk - Long-term public key of the new controller
     * @param {boolean} isAdmin - Whether or not the new controller is an admin
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildAddPairingM1(identifier: string, ltpk: Buffer, isAdmin: boolean): Promise<Buffer> {
        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M1]));
        data.set(Types.kTLVType_Method, Buffer.from([Methods.AddPairing]));
        data.set(Types.kTLVType_Identifier, Buffer.from(identifier));
        data.set(Types.kTLVType_PublicKey, ltpk);
        data.set(Types.kTLVType_Permissions, Buffer.from([isAdmin ? 1 : 0]));
        const packet = encodeObject(data);
        return packet;
    }

    /**
     * Parse step 2 of the add pairing process.
     *
     * @param {Buffer} m2Buffer - Buffer containing M2 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parseAddPairingM2(m2Buffer: Buffer): Promise<TLV> {
        const tlv = decodeBuffer(m2Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M2: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M2: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M2: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M2) {
            throw new Error(`M2: Invalid state: ${state}`);
        }

        return tlv;
    }

    /**
     * Build step 1 of the remove pairing process.
     *
     * @param {Buffer} identifier - Identifier of the controller to remove
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildRemovePairingM1(identifier: Buffer): Promise<Buffer> {
        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M1]));
        data.set(Types.kTLVType_Method, Buffer.from([Methods.RemovePairing]));
        data.set(Types.kTLVType_Identifier, identifier);
        const packet = encodeObject(data);
        return packet;
    }

    /**
     * Parse step 2 of the remove pairing process.
     *
     * @param {Buffer} m2Buffer - Buffer containing M2 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parseRemovePairingM2(m2Buffer: Buffer): Promise<TLV> {
        const tlv = decodeBuffer(m2Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M2: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M2: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M2: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M2) {
            throw new Error(`M2: Invalid state: ${state}`);
        }

        return tlv;
    }

    /**
     * Build step 1 of the list pairings process.
     *
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildListPairingsM1(): Promise<Buffer> {
        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M1]));
        data.set(Types.kTLVType_Method, Buffer.from([Methods.ListPairings]));
        const packet = encodeObject(data);
        return packet;
    }

    /**
     * Parse step 2 of the list pairings process.
     *
     * @param {Buffer} m2Buffer - Buffer containing M2 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parseListPairingsM2(m2Buffer: Buffer): Promise<TLV> {
        const tlv = decodeBuffer(m2Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M2: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M2: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M2: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M2) {
            throw new Error(`M2: Invalid state: ${state}`);
        }

        return tlv;
    }

    /**
     * Build step 1 of the pair resume process.
     *
     * @returns {Promise} Promise which resolves to a Buffer.
     */
    async buildPairResumeM1(): Promise<Buffer> {
        if (!this.pairVerify.sharedSecret) {
            throw new Error('M1: Shared secret not yet set');
        }

        await sodium.ready;

        if (!this.pairVerify.sessionID) {
            throw new Error('M1: Session ID not yet set');
        }

        this.pairVerify.privateKey = Buffer.from(sodium.randombytes_buf(32));

        this.pairVerify.publicKey = Buffer.from(sodium.crypto_scalarmult_base(this.pairVerify.privateKey));

        const hkdf = new HKDF(
            'sha512',
            Buffer.concat([this.pairVerify.publicKey, this.pairVerify.sessionID!]),
            this.pairVerify.sharedSecret!
        );

        const requestKey = hkdf.derive('Pair-Resume-Request-Info', 32);
        const encryptedData = Buffer.from(
            sodium.crypto_aead_chacha20poly1305_ietf_encrypt(
                Buffer.alloc(0),
                null,
                null,
                Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PR-Msg01')]),
                requestKey
            )
        );

        const data = new Map();
        data.set(Types.kTLVType_State, Buffer.from([Steps.M1]));
        data.set(Types.kTLVType_Method, Buffer.from([Methods.PairResume]));
        data.set(Types.kTLVType_PublicKey, this.pairVerify.publicKey);
        data.set(Types.kTLVType_SessionID, this.pairVerify.sessionID);
        data.set(Types.kTLVType_EncryptedData, encryptedData);
        const packet = encodeObject(data);

        return packet;
    }

    /**
     * Parse step 2 of the pair resume process.
     *
     * @param {Buffer} m2Buffer - Buffer containing M2 response
     * @returns {Promise} Promise which resolves to a TLV object.
     */
    async parsePairResumeM2(m2Buffer: Buffer): Promise<TLV> {
        await sodium.ready;

        if (!this.pairVerify.publicKey) {
            throw new Error('M2: Public key not yet set');
        }

        if (!this.pairVerify.sharedSecret) {
            throw new Error('M2: Shared secret not yet set');
        }

        const tlv = decodeBuffer(m2Buffer);

        if (!tlv || tlv.size === 0) {
            throw new Error('M2: Empty TLV');
        }

        if (tlv.has(Types.kTLVType_Error)) {
            throw new Error(`M2: Error: ${tlv.get(Types.kTLVType_Error)!.readUInt8(0)}`);
        }

        if (!tlv.has(Types.kTLVType_State)) {
            throw new Error('M2: Missing state');
        }

        const state = tlv.get(Types.kTLVType_State)![0];
        if (state !== Steps.M2) {
            throw new Error(`M2: Invalid state: ${state}`);
        }

        if (!tlv.has(Types.kTLVType_SessionID)) {
            throw new Error('M2: Session ID missing from TLV');
        }

        if (!tlv.has(Types.kTLVType_EncryptedData)) {
            throw new Error('M2: Encrypted data missing from TLV');
        }

        this.pairVerify.sessionID = tlv.get(Types.kTLVType_SessionID)!;

        const hkdf1 = new HKDF(
            'sha512',
            Buffer.concat([this.pairVerify.publicKey, this.pairVerify.sessionID]),
            this.pairVerify.sharedSecret!
        );
        const responseKey = hkdf1.derive('Pair-Resume-Response-Info', 32);

        try {
            sodium.crypto_aead_chacha20poly1305_ietf_decrypt(
                null,
                tlv.get(Types.kTLVType_EncryptedData)!,
                null,
                Buffer.concat([Buffer.from([0, 0, 0, 0]), Buffer.from('PR-Msg02')]),
                responseKey
            );
        } catch (_e) {
            throw new Error('M2: Decryption of data failed');
        }

        const hkdf2 = new HKDF(
            'sha512',
            Buffer.concat([this.pairVerify.publicKey!, this.pairVerify.sessionID!]),
            this.pairVerify.sharedSecret!
        );
        this.pairVerify.sharedSecret = hkdf2.derive('Pair-Resume-Shared-Secret-Info', 32);

        return tlv;
    }

    /**
     * Get the data (keys) that needs to be stored long-term.
     *
     * @returns {PairingProtocol} Object containing the keys that should be stored.
     */
    getLongTermData(): PairingData | null {
        if (
            !this.AccessoryPairingID ||
            !this.AccessoryLTPK ||
            !this.iOSDevicePairingID ||
            !this.iOSDeviceLTSK ||
            !this.iOSDeviceLTPK
        ) {
            return null;
        }

        return {
            AccessoryPairingID: PairingProtocol.bufferToHex(this.AccessoryPairingID),
            AccessoryLTPK: PairingProtocol.bufferToHex(this.AccessoryLTPK),
            iOSDevicePairingID: PairingProtocol.bufferToHex(this.iOSDevicePairingID),
            iOSDeviceLTSK: PairingProtocol.bufferToHex(this.iOSDeviceLTSK),
            iOSDeviceLTPK: PairingProtocol.bufferToHex(this.iOSDeviceLTPK),
        };
    }
}
