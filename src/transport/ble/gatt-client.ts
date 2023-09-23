/**
 * Controller class for interacting with a HAP device over GATT.
 */

import * as Characteristic from '../../model/characteristic';
import { EventEmitter } from 'events';
import GattConnection from './gatt-connection';
import * as GattConstants from './gatt-constants';
import GattProtocol from './gatt-protocol';
import * as GattUtils from './gatt-utils';
import PairingProtocol, { PairingData, PairMethods } from '../../protocol/pairing-protocol';
import * as Service from '../../model/service';
import { decodeBuffer, TLV } from '../../model/tlv';
import { Characteristic as NobleCharacteristic, Peripheral as NoblePeripheral } from '@abandonware/noble';
import { DiscoveryPairingFeatureFlags } from '../ip/ip-discovery';
import Debug from 'debug';
import { Accessories } from '../../model/accessory';
import { OpQueue } from '../../utils/queue';

const debug = Debug('hap-controller:gatt-client');

export interface GetCharacteristicsOptions {
    meta?: boolean;
    perms?: boolean;
    type?: boolean;
    ev?: boolean;
    extra?: boolean;
}

interface GattSubscriptionCharacteristicData {
    characteristicUuid: string;
    serviceUuid: string;
    iid: number;
    format: string;
}

export default class GattClient extends EventEmitter {
    deviceId: string;

    private peripheral: NoblePeripheral;

    private pairingProtocol: PairingProtocol;

    private gattProtocol: GattProtocol;

    private tid: number;

    private queue: OpQueue;

    private pairingQueue: OpQueue;

    private _pairingConnection?: GattConnection;

    private subscriptionConnection?: GattConnection;

    private subscribedCharacteristics: {
        characteristicUuid: string;
        serviceUuid: string;
        iid: number;
        format: string;
    }[] = [];

    /**
     * Initialize the GattClient object.
     *
     * @param {string} deviceId - ID of the device
     * @param {NoblePeripheral} peripheral - Peripheral object from noble
     * @param {PairingData?} pairingData - existing pairing data
     */
    constructor(deviceId: string, peripheral: NoblePeripheral, pairingData?: PairingData) {
        super();
        this.deviceId = deviceId;
        this.peripheral = peripheral;
        this.pairingProtocol = new PairingProtocol(pairingData);
        this.gattProtocol = new GattProtocol();
        this.tid = Math.floor(Math.random() * 254);
        this.queue = new OpQueue();
        this.pairingQueue = new OpQueue();
    }

    /**
     * Queue an operation for the client.
     *
     * @param {function} op - Function to add to the queue
     * @returns {Promise} Promise which resolves when the function is called.
     */
    private _queueOperation<T>(op: () => Promise<T>): Promise<T> {
        return this.queue.queue(op);
    }

    /**
     * Queue an operation for the pairing.
     *
     * @param {function} op - Function to add to the queue
     * @returns {Promise} Promise which resolves when the function is called.
     */
    private _queuePairingOperation<T>(op: () => Promise<T>): Promise<T> {
        return this.pairingQueue.queue(op);
    }

    /**
     * Get the next transaction ID.
     *
     * @returns {number} Transaction ID.
     */
    getNextTransactionId(): number {
        this.tid++;

        if (this.tid > 255) {
            this.tid = 0;
        }

        return this.tid;
    }

    /**
     * Get the data (keys) that needs to be stored long-term.
     *
     * @returns {PairingData} Object containing the keys that should be stored.
     */
    getLongTermData(): PairingData | null {
        return this.pairingProtocol.getLongTermData();
    }

    /**
     * Verify the provided PIN
     *
     * @param pin {string} PIN
     */
    verifyPin(pin: string): void {
        this.pairingProtocol.verifyPin(pin);
    }

    /**
     * Run the identify routine on a device.
     *
     * @returns {Promise} Promise which resolves if identify succeeded.
     */
    identify(): Promise<void> {
        const serviceUuid = GattUtils.uuidToNobleUuid(
            Service.uuidFromService('public.hap.service.accessory-information'),
        );
        const characteristicUuid = GattUtils.uuidToNobleUuid(
            Characteristic.uuidFromCharacteristic('public.hap.characteristic.identify'),
        );

        return this._queueOperation(async () => {
            const connection = new GattConnection(this.peripheral);

            try {
                await connection.connect();

                const { characteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync([serviceUuid], [characteristicUuid]),
                ).getPromise();

                const characteristic = characteristics.find((c) => {
                    return c.uuid === characteristicUuid;
                });

                if (!characteristic) {
                    throw new Error('Identify characteristic not found');
                }

                const iid = await this._readInstanceId(characteristic);

                const data = new Map();
                data.set(GattConstants.Types['HAP-Param-Value'], Buffer.from([1]));
                const pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, data);

                const pdus = await connection.writeCharacteristic(characteristic, [pdu]);

                if (pdus.length === 0) {
                    throw new Error('No response from identify routine');
                }

                const status = pdus[0].readUInt8(2);
                if (status !== 0) {
                    throw new Error(`Identify returned error status: ${status}`);
                }

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
        });
    }

    /**
     * Read the instance ID descriptor for a characteristic. The peripheral must
     * already be connected.
     *
     * @param {Object} characteristic - The characteristic to read from
     * @returns {Promise} Promise which resolves to the IID.
     */
    private async _readInstanceId(characteristic: NobleCharacteristic): Promise<number> {
        const characteristicInstanceIdUuid = GattUtils.uuidToNobleUuid(GattConstants.CharacteristicInstanceIdUuid);

        const characteristicInstanceIdShortUuid = GattUtils.uuidToNobleUuid(
            GattConstants.CharacteristicInstanceIdShortUuid,
        );

        const descriptors = await new GattUtils.Watcher(
            this.peripheral,
            characteristic.discoverDescriptorsAsync(),
        ).getPromise();

        const descriptor = descriptors.find((d) => {
            return d.uuid === characteristicInstanceIdUuid || d.uuid === characteristicInstanceIdShortUuid;
        });

        if (!descriptor) {
            throw new Error('Could not find IID');
        }

        const data = await new GattUtils.Watcher(this.peripheral, descriptor.readValueAsync()).getPromise();

        return data.readUInt16LE(0);
    }

    async getPairingMethod(): Promise<number> {
        const serviceUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
        const featureCharacteristicUuid = GattUtils.uuidToNobleUuid(
            Characteristic.uuidFromCharacteristic('public.hap.characteristic.pairing.features'),
        );

        return this._queueOperation(async () => {
            const connection = new GattConnection(this.peripheral);

            try {
                await connection.connect();

                const { characteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
                        [serviceUuid],
                        [featureCharacteristicUuid],
                    ),
                ).getPromise();

                const characteristic = characteristics.find((c) => {
                    return c.uuid === featureCharacteristicUuid;
                });

                if (!characteristic) {
                    throw new Error('pairing.features characteristic not found');
                }

                const iid = await this._readInstanceId(characteristic);

                const pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                const pdus = await connection.writeCharacteristic(characteristic, [pdu]);

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});

                if (pdus.length !== 0) {
                    const response = pdus[0];
                    const pairFeatures = response.readUInt8();
                    const pairMethod =
                        pairFeatures & DiscoveryPairingFeatureFlags.SupportsAppleAuthenticationCoprocessor
                            ? PairMethods.PairSetupWithAuth
                            : PairMethods.PairSetup;
                    return pairMethod;
                } else {
                    throw new Error('Could not read the Pairing Feature information');
                }
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
        });
    }

    /**
     * Begins the pairing process. For devices with random pins, this
     * will cause it to show the pin on the screen.
     *
     * @param {PairMethods} [pairMethod] - Method to use for pairing, default is PairSetupWithAuth
     * @param {PairingTypeFlags} [pairFlags] - Flags to use for Pairing for PairSetup
     *                                         * No provided flags is equivalent to providing
     *                                           kPairingFlag_Transient and kPairingFlag_Split and in this case a new
     *                                           code is generated randomly by the device (if supported) or the
     *                                           pre-defined code is used
     *                                         * If only the flag kPairingFlag_Split is provided the code which
     *                                           was created on the device from last transient+split call is reused
     *                                           and needs to be provided in finishPairing by user of this library
     *                                         * If only the flag kPairingFlag_Transient is provided the session
     *                                           security is enabled but no final pairing is done
     * @returns {Promise} Promise which resolves to opaque
     * pairing data when complete.
     */
    async startPairing(
        pairMethod = PairMethods.PairSetupWithAuth,
        pairFlags = 0,
    ): Promise<{ tlv: TLV; iid: number; characteristic: NobleCharacteristic }> {
        const serviceUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
        const characteristicUuid = GattUtils.uuidToNobleUuid(
            Characteristic.uuidFromCharacteristic('public.hap.characteristic.pairing.pair-setup'),
        );

        return this._queueOperation(async () => {
            const connection = (this._pairingConnection = new GattConnection(this.peripheral));

            await connection.connect();

            const { characteristics } = await new GattUtils.Watcher(
                this.peripheral,
                this.peripheral.discoverSomeServicesAndCharacteristicsAsync([serviceUuid], [characteristicUuid]),
            ).getPromise();

            const characteristic = characteristics.find((c) => {
                return c.uuid === characteristicUuid;
            });

            if (!characteristic) {
                throw new Error('pair-setup characteristic not found');
            }

            const iid = await this._readInstanceId(characteristic);

            const packet = await this.pairingProtocol.buildPairSetupM1(pairMethod, pairFlags);
            const data = new Map();
            data.set(GattConstants.Types['HAP-Param-Value'], packet);
            data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
            let pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, data);
            let pdus = await connection.writeCharacteristic(characteristic, [pdu]);

            if (pdus.length === 0) {
                throw new Error('M1: No response');
            }

            let response = pdus[0];
            let status = response.readUInt8(2);
            if (status !== 0) {
                throw new Error(`M1: Got error status: ${status}`);
            }

            if (response.length < 5) {
                pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                pdus = await connection.writeCharacteristic(characteristic, [pdu]);

                if (pdus.length === 0) {
                    throw new Error('M2: No response');
                }

                response = pdus[0];
                status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M2: Got error status: ${status}`);
                }
            }

            const body = decodeBuffer(response.slice(5, response.length));

            if (!body.has(GattConstants.Types['HAP-Param-Value'])) {
                throw new Error('M2: HAP-Param-Value missing');
            }

            const tlv = await this.pairingProtocol.parsePairSetupM2(body.get(GattConstants.Types['HAP-Param-Value'])!);

            return { tlv, iid, characteristic };
        });
    }

    /**
     * Finishes a pairing process that began with startPairing()
     *
     * @param {PairingData} pairingData - The pairing data returned from startPairing()
     * @param {string} pin - The pairing PIN, needs to be formatted as XXX-XX-XXX
     * @returns {Promise} Promise which resolves when pairing is complete.
     */
    async finishPairing(
        pairingData: { tlv: TLV; iid: number; characteristic: NobleCharacteristic },
        pin: string,
    ): Promise<void> {
        const { tlv, iid, characteristic } = pairingData;

        this.verifyPin(pin);

        if (!this._pairingConnection) {
            throw new Error('Must call startPairing() first');
        }

        return this._queueOperation(async () => {
            const connection = this._pairingConnection!;
            const protocol = this.pairingProtocol;

            try {
                const m3 = await protocol.buildPairSetupM3(tlv, pin);
                const m3Data = new Map();
                m3Data.set(GattConstants.Types['HAP-Param-Value'], m3);
                m3Data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                const m3Pdu = this.gattProtocol.buildCharacteristicWriteRequest(
                    this.getNextTransactionId(),
                    iid,
                    m3Data,
                );

                let pdus = await connection.writeCharacteristic(characteristic, [m3Pdu]);
                if (pdus.length === 0) {
                    throw new Error('M3: No response');
                }

                let response = pdus[0];
                let status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M3: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    const pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);

                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M4: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M4: Got error status: ${status}`);
                    }
                }

                const buffers = [pdus[0].slice(5, pdus[0].length)];
                pdus.slice(1).map((p) => buffers.push(p.slice(2, p.length)));

                const m4Body = decodeBuffer(Buffer.concat(buffers));

                if (!m4Body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M4: HAP-Param-Value missing');
                }

                await this.pairingProtocol.parsePairSetupM4(m4Body.get(GattConstants.Types['HAP-Param-Value'])!);

                if (!this.pairingProtocol.isTransientOnlyPairSetup()) {
                    // According to specs for a transient pairSetup process no M5/6 is done, which should end in a
                    // "non pairing" result and we miss AccessoryId and AccessoryLTPK, but the current session is
                    // authenticated

                    const m5 = await this.pairingProtocol.buildPairSetupM5();
                    const m5Data = new Map();
                    m5Data.set(GattConstants.Types['HAP-Param-Value'], m5);
                    m5Data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                    const m5Pdu = this.gattProtocol.buildCharacteristicWriteRequest(
                        this.getNextTransactionId(),
                        iid,
                        m5Data,
                    );

                    pdus = await connection.writeCharacteristic(characteristic, [m5Pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M5: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M5: Got error status: ${status}`);
                    }

                    if (response.length < 5) {
                        const pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                        pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                        if (pdus.length === 0) {
                            throw new Error('M6: No response');
                        }

                        response = pdus[0];
                        status = response.readUInt8(2);
                        if (status !== 0) {
                            throw new Error(`M6: Got error status: ${status}`);
                        }
                    }

                    const m6Body = decodeBuffer(response.slice(5, response.length));

                    if (!m6Body.has(GattConstants.Types['HAP-Param-Value'])) {
                        throw new Error('M6: HAP-Param-Value missing');
                    }

                    await this.pairingProtocol.parsePairSetupM6(m6Body.get(GattConstants.Types['HAP-Param-Value'])!);
                }

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
        });
    }

    /**
     * Attempt to pair with a device.
     *
     * @param {string} pin - The pairing PIN, needs to be formatted as XXX-XX-XXX
     * @param {PairMethods} [pairMethod] - Method to use for pairing, default is PairSetupWithAuth
     * @param {PairingTypeFlags} [pairFlags] - Flags to use for Pairing for PairSetup
     * @returns {Promise} Promise which resolves when pairing is complete.
     */
    async pairSetup(pin: string, pairMethod = PairMethods.PairSetupWithAuth, pairFlags = 0): Promise<void> {
        return await this.finishPairing(await this.startPairing(pairMethod, pairFlags), pin);
    }

    /**
     * Method used internally to generate session keys for a connection.
     *
     * @private
     * @param {GattConnection} connection - Existing GattConnection object
     * @returns {Promise} Promise which resolves when the pairing has been verified.
     */
    private async _pairVerify(connection: GattConnection): Promise<void> {
        return this._queuePairingOperation(async () => {
            debug('Start Pair-Verify process ...');
            const serviceUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
            const characteristicUuid = GattUtils.uuidToNobleUuid(
                Characteristic.uuidFromCharacteristic('public.hap.characteristic.pairing.pair-verify'),
            );

            const { characteristics } = await new GattUtils.Watcher(
                this.peripheral,
                this.peripheral.discoverSomeServicesAndCharacteristicsAsync([serviceUuid], [characteristicUuid]),
            ).getPromise();

            const characteristic = characteristics.find((c) => {
                return c.uuid === characteristicUuid;
            });

            if (!characteristic) {
                throw new Error('pair-verify characteristic not found');
            }
            const iid = await this._readInstanceId(characteristic);

            if (this.pairingProtocol.canResume()) {
                const m1 = await this.pairingProtocol.buildPairResumeM1();
                const m1Data = new Map();
                m1Data.set(GattConstants.Types['HAP-Param-Value'], m1);
                m1Data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                let pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, m1Data);

                let pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                if (pdus.length === 0) {
                    throw new Error('M1: No response');
                }

                let response = pdus[0];
                let status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M1: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    const pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M2: No response');
                    }

                    const response = pdus[0];
                    const status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M2: Got error status: ${status}`);
                    }
                }

                const m2Body = decodeBuffer(response.slice(5, response.length));

                if (!m2Body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M2: HAP-Param-Value missing');
                }

                try {
                    await this.pairingProtocol.parsePairResumeM2(m2Body.get(GattConstants.Types['HAP-Param-Value'])!);
                } catch (_) {
                    await this.pairingProtocol.parsePairVerifyM2(m2Body.get(GattConstants.Types['HAP-Param-Value'])!);

                    const m3 = await this.pairingProtocol.buildPairVerifyM3();
                    const m3Data = new Map();
                    m3Data.set(GattConstants.Types['HAP-Param-Value'], m3);
                    m3Data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                    pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, m3Data);

                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M3: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M3: Got error status: ${status}`);
                    }

                    if (response.length < 5) {
                        pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                        pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                        if (pdus.length === 0) {
                            throw new Error('M4: No response');
                        }

                        response = pdus[0];
                        status = response.readUInt8(2);
                        if (status !== 0) {
                            throw new Error(`M4: Got error status: ${status}`);
                        }
                    }

                    const m4Body = decodeBuffer(response.slice(5, response.length));

                    if (!m4Body.has(GattConstants.Types['HAP-Param-Value'])) {
                        throw new Error('M4: HAP-Param-Value missing');
                    }

                    await this.pairingProtocol.parsePairVerifyM4(m4Body.get(GattConstants.Types['HAP-Param-Value'])!);
                }
            } else {
                const m1 = await this.pairingProtocol.buildPairVerifyM1();
                const m1Data = new Map();
                m1Data.set(GattConstants.Types['HAP-Param-Value'], m1);
                m1Data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                let pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, m1Data);

                let pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                if (pdus.length === 0) {
                    throw new Error('M1: No response');
                }

                let response = pdus[0];
                let status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M1: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);

                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M2: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M2: Got error status: ${status}`);
                    }
                }

                const m2Body = decodeBuffer(response.slice(5, response.length));

                if (!m2Body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M2: HAP-Param-Value missing');
                }

                await this.pairingProtocol.parsePairVerifyM2(m2Body.get(GattConstants.Types['HAP-Param-Value'])!);

                const m3 = await this.pairingProtocol.buildPairVerifyM3();
                const m3Data = new Map();
                m3Data.set(GattConstants.Types['HAP-Param-Value'], m3);
                m3Data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, m3Data);

                pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                if (pdus.length === 0) {
                    throw new Error('M3: No response');
                }

                response = pdus[0];
                status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M3: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);

                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M4: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M4: Got error status: ${status}`);
                    }
                }

                const m4Body = decodeBuffer(response.slice(5, response.length));

                if (!m4Body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M4: HAP-Param-Value missing');
                }

                await this.pairingProtocol.parsePairVerifyM4(m4Body.get(GattConstants.Types['HAP-Param-Value'])!);
            }

            const keys = await this.pairingProtocol.getSessionKeys();
            connection.setSessionKeys(keys);
            debug('Finished Pair-Verify process ...');
        });
    }

    /**
     * Unpair the controller from a device.
     *
     * @param {string|Buffer} identifier - Identifier of the controller to remove
     * @returns {Promise} Promise which resolves when the process completes.
     */
    removePairing(identifier: string | Buffer): Promise<void> {
        const serviceUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
        const characteristicUuid = GattUtils.uuidToNobleUuid(
            Characteristic.uuidFromCharacteristic('public.hap.characteristic.pairing.pairings'),
        );

        return this._queueOperation(async () => {
            const connection = new GattConnection(this.peripheral);

            try {
                if (typeof identifier === 'string') {
                    identifier = PairingProtocol.bufferFromHex(identifier);
                }

                await connection.connect();
                await this._pairVerify(connection);

                const { characteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync([serviceUuid], [characteristicUuid]),
                ).getPromise();

                const characteristic = characteristics.find((c) => {
                    return c.uuid === characteristicUuid;
                });

                if (!characteristic) {
                    throw new Error('pairings characteristic not found');
                }

                const iid = await this._readInstanceId(characteristic);

                await this._pairVerify(connection);

                const packet = await this.pairingProtocol.buildRemovePairingM1(identifier);
                const data = new Map();
                data.set(GattConstants.Types['HAP-Param-Value'], packet);
                data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                const pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, data);

                let pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                if (pdus.length === 0) {
                    throw new Error('M1: No response');
                }

                let response = pdus[0];
                let status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M1: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    const pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);

                    if (pdus.length === 0) {
                        throw new Error('M2: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M2: Got error status: ${status}`);
                    }
                }

                const body = decodeBuffer(response.slice(5, response.length));

                if (!body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M2: HAP-Param-Value missing');
                }

                await this.pairingProtocol.parseRemovePairingM2(body.get(GattConstants.Types['HAP-Param-Value'])!);

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
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
    addPairing(identifier: string, ltpk: Buffer, isAdmin: boolean): Promise<void> {
        const serviceUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
        const characteristicUuid = GattUtils.uuidToNobleUuid(
            Characteristic.uuidFromCharacteristic('public.hap.characteristic.pairing.pairings'),
        );

        return this._queueOperation(async () => {
            const connection = new GattConnection(this.peripheral);

            try {
                await connection.connect();

                const { characteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync([serviceUuid], [characteristicUuid]),
                ).getPromise();

                const characteristic = characteristics.find((c) => {
                    return c.uuid === characteristicUuid;
                });

                if (!characteristic) {
                    throw new Error('pairings characteristic not found');
                }

                const iid = await this._readInstanceId(characteristic);

                await this._pairVerify(connection);

                const packet = await this.pairingProtocol.buildAddPairingM1(identifier, ltpk, isAdmin);
                const data = new Map();
                data.set(GattConstants.Types['HAP-Param-Value'], packet);
                data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                let pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, data);

                let pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                if (pdus.length === 0) {
                    throw new Error('M1: No response');
                }

                let response = pdus[0];
                let status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M1: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M2: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M2: Got error status: ${status}`);
                    }
                }

                const body = decodeBuffer(response.slice(5, response.length));

                if (!body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M2: HAP-Param-Value missing');
                }

                await this.pairingProtocol.parseAddPairingM2(body.get(GattConstants.Types['HAP-Param-Value'])!);

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect();
                throw err;
            }
        });
    }

    /**
     * List the pairings on a device.
     *
     * @returns {Promise} Promise which resolves to the final TLV when the process
     *                    is complete.
     */
    listPairings(): Promise<TLV> {
        const serviceUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
        const characteristicUuid = GattUtils.uuidToNobleUuid(
            Characteristic.uuidFromCharacteristic('public.hap.characteristic.pairing.pairings'),
        );

        return this._queueOperation(async () => {
            const connection = new GattConnection(this.peripheral);

            try {
                await connection.connect();

                const { characteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync([serviceUuid], [characteristicUuid]),
                ).getPromise();

                const characteristic = characteristics.find((c) => {
                    return c.uuid === characteristicUuid;
                });

                if (!characteristic) {
                    throw new Error('pairings characteristic not found');
                }

                const iid = await this._readInstanceId(characteristic);

                await this._pairVerify(connection);

                const packet = await this.pairingProtocol.buildListPairingsM1();
                const data = new Map();
                data.set(GattConstants.Types['HAP-Param-Value'], packet);
                data.set(GattConstants.Types['HAP-Param-Return-Response'], Buffer.from([1]));
                let pdu = this.gattProtocol.buildCharacteristicWriteRequest(this.getNextTransactionId(), iid, data);

                let pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                if (pdus.length === 0) {
                    throw new Error('M1: No response');
                }

                let response = pdus[0];
                let status = response.readUInt8(2);
                if (status !== 0) {
                    throw new Error(`M1: Got error status: ${status}`);
                }

                if (response.length < 5) {
                    pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);
                    pdus = await connection.writeCharacteristic(characteristic, [pdu]);
                    if (pdus.length === 0) {
                        throw new Error('M2: No response');
                    }

                    response = pdus[0];
                    status = response.readUInt8(2);
                    if (status !== 0) {
                        throw new Error(`M2: Got error status: ${status}`);
                    }
                }

                const body = decodeBuffer(response.slice(5, response.length));

                if (!body.has(GattConstants.Types['HAP-Param-Value'])) {
                    throw new Error('M2: HAP-Param-Value missing');
                }

                const tlv = await this.pairingProtocol.parseListPairingsM2(
                    body.get(GattConstants.Types['HAP-Param-Value'])!,
                );

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});

                return tlv;
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
        });
    }

    /**
     * Get the accessory attribute database from a device.
     *
     * @returns {Promise} Promise which resolves to the JSON document.
     */
    getAccessories(): Promise<Accessories> {
        const pairingUuid = GattUtils.uuidToNobleUuid(Service.uuidFromService('public.hap.service.pairing'));
        const protocolInformationUuid = GattUtils.uuidToNobleUuid(
            Service.uuidFromService('public.hap.service.protocol.information.service'),
        );
        const serviceInstanceIdUuid = GattUtils.uuidToNobleUuid(GattConstants.ServiceInstanceIdUuid);
        const serviceSignatureUuid = GattUtils.uuidToNobleUuid(GattConstants.ServiceSignatureUuid);

        return this._queueOperation(async () => {
            const database: Accessories = {
                accessories: [
                    {
                        aid: 1,
                        services: [],
                    },
                ],
            };

            const connection = new GattConnection(this.peripheral);
            try {
                await connection.connect();

                const { services, characteristics: allCharacteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverAllServicesAndCharacteristicsAsync(),
                ).getPromise();

                // Get the Service IIDs
                let queue = new OpQueue();
                let lastOp = Promise.resolve();
                for (const service of services) {
                    if (service.uuid === pairingUuid || service.uuid === protocolInformationUuid) {
                        continue;
                    }

                    const characteristic = service.characteristics.find((c) => {
                        return c.uuid === serviceInstanceIdUuid;
                    });

                    if (!characteristic) {
                        continue;
                    }

                    lastOp = queue.queue(async () => {
                        const data = await new GattUtils.Watcher(
                            this.peripheral,
                            characteristic.readAsync(),
                        ).getPromise();

                        database.accessories[0].services.push({
                            iid: data.readUInt16LE(0),
                            type: GattUtils.nobleUuidToUuid(service.uuid),
                            characteristics: service.characteristics
                                .filter((c) => {
                                    return c.uuid !== serviceInstanceIdUuid && c.uuid !== serviceSignatureUuid;
                                })
                                .map((c) => {
                                    return {
                                        type: GattUtils.nobleUuidToUuid(c.uuid),
                                        perms: [],
                                        format: 'data',
                                    };
                                }),
                        });
                    });
                }

                await lastOp;

                queue = new OpQueue();
                lastOp = Promise.resolve();

                const characteristics: { characteristic: NobleCharacteristic; iid: number }[] = [];
                for (const characteristic of allCharacteristics) {
                    lastOp = queue.queue(async () => {
                        try {
                            const iid = await this._readInstanceId(characteristic);
                            const serviceType = GattUtils.nobleUuidToUuid(
                                (<{ _serviceUuid: string }>(<unknown>characteristic))._serviceUuid,
                            );
                            const characteristicType = GattUtils.nobleUuidToUuid(characteristic.uuid);

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
                            characteristics.push({ characteristic, iid });
                        } catch (_) {
                            // Ignore errors here, as not all characteristics will have IIDs
                        }
                    });
                }

                await lastOp;

                queue = new OpQueue();
                lastOp = Promise.resolve();

                for (const c of characteristics) {
                    const serviceUuid = GattUtils.nobleUuidToUuid(
                        (<{ _serviceUuid: string }>(<unknown>c.characteristic))._serviceUuid,
                    );
                    const characteristicUuid = GattUtils.nobleUuidToUuid(c.characteristic.uuid);

                    if (characteristicUuid === GattConstants.ServiceSignatureUuid) {
                        const service = database.accessories[0].services.find((s) => {
                            return s.type === serviceUuid;
                        });

                        if (!service) {
                            continue;
                        }

                        const pdu = this.gattProtocol.buildServiceSignatureReadRequest(
                            this.getNextTransactionId(),
                            service.iid,
                        );

                        lastOp = queue.queue(async () => {
                            const pdus = await connection.writeCharacteristic(c.characteristic, [pdu]);
                            if (pdus.length === 0) {
                                return;
                            }

                            const response = pdus[0];
                            const body = decodeBuffer(response.slice(5, response.length));

                            const props = body.get(GattConstants.Types['HAP-Param-HAP-Service-Properties']);
                            if (props && props.length) {
                                switch (props.readUInt16LE(0)) {
                                    case 1:
                                        service.primary = true;
                                        break;
                                    case 2:
                                        service.hidden = true;
                                        break;
                                }
                            }
                            const linked = body.get(GattConstants.Types['HAP-Param-HAP-Linked-Services']);
                            if (linked && linked.length) {
                                service.linked = [];
                                for (let idx = 0; idx < linked.length; idx += 2) {
                                    service.linked.push(linked.readUInt16LE(idx));
                                }
                            }
                        });
                    }
                }

                await lastOp;

                await this._pairVerify(connection);

                const toFetch = [];
                for (const c of characteristics) {
                    const serviceUuid = GattUtils.nobleUuidToUuid(
                        (<{ _serviceUuid: string }>(<unknown>c.characteristic))._serviceUuid,
                    );
                    const characteristicUuid = GattUtils.nobleUuidToUuid(c.characteristic.uuid);

                    if (
                        characteristicUuid !== GattConstants.ServiceSignatureUuid &&
                        (<{ _serviceUuid: string }>(<unknown>c.characteristic))._serviceUuid !==
                            protocolInformationUuid &&
                        (<{ _serviceUuid: string }>(<unknown>c.characteristic))._serviceUuid !== pairingUuid
                    ) {
                        toFetch.push({
                            serviceUuid,
                            characteristicUuid,
                            iid: c.iid,
                        });
                    }
                }

                const list = await this.getCharacteristics(
                    toFetch,
                    {
                        meta: true,
                        perms: true,
                        ev: true,
                        type: true,
                        extra: true,
                    },
                    connection,
                );

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

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});

                return database;
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
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
    getCharacteristics(
        characteristics: {
            characteristicUuid: string;
            serviceUuid: string;
            iid: number;
            format?: string;
        }[],
        options: GetCharacteristicsOptions = {},
        connection: GattConnection | null = null,
    ): Promise<{ characteristics: Characteristic.CharacteristicObject[] }> {
        const skipQueue = connection !== null;

        const fn = async (): Promise<{ characteristics: Characteristic.CharacteristicObject[] }> => {
            options = Object.assign(
                {
                    meta: false,
                    perms: false,
                    type: false,
                    ev: false,
                    extra: false,
                },
                options,
            );

            const cList: NobleCharacteristic[] = [];
            let needToClose = false;

            try {
                if (!connection) {
                    needToClose = true;
                    connection = new GattConnection(this.peripheral);

                    await connection.connect();
                    await this._pairVerify(connection);
                }

                for (const c of characteristics) {
                    c.characteristicUuid = GattUtils.uuidToNobleUuid(c.characteristicUuid);
                    c.serviceUuid = GattUtils.uuidToNobleUuid(c.serviceUuid);
                }

                const { characteristics: discoveredCharacteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
                        Array.from(new Set(characteristics.map((c) => c.serviceUuid))),
                        Array.from(new Set(characteristics.map((c) => c.characteristicUuid))),
                    ),
                ).getPromise();

                for (const c of characteristics) {
                    const characteristic = discoveredCharacteristics.find((d) => {
                        return (
                            (<{ _serviceUuid: string }>(<unknown>d))._serviceUuid === c.serviceUuid &&
                            d.uuid === c.characteristicUuid
                        );
                    });

                    if (!characteristic) {
                        throw new Error(`Characteristic not found: ${JSON.stringify(c)}`);
                    }

                    cList.push(characteristic);
                }

                const entries: Characteristic.CharacteristicObject[] = [];
                if (options.meta || options.perms || options.extra) {
                    const queue = new OpQueue();
                    let lastOp = Promise.resolve();

                    for (const c of cList) {
                        const match = characteristics.find((ch) => {
                            return (
                                ch.serviceUuid === (<{ _serviceUuid: string }>(<unknown>c))._serviceUuid &&
                                ch.characteristicUuid === c.uuid
                            );
                        });

                        if (!match) {
                            continue;
                        }

                        const iid = match.iid;
                        const pdu = this.gattProtocol.buildCharacteristicSignatureReadRequest(
                            this.getNextTransactionId(),
                            iid,
                        );

                        lastOp = queue.queue(async () => {
                            const pdus = await connection!.writeCharacteristic(c, [pdu]);
                            if (pdus.length === 0) {
                                throw new Error('No signature read response');
                            }

                            const entry: Characteristic.CharacteristicObject = { aid: 1, iid };
                            const response = pdus[0];
                            const status = response.readUInt8(2);
                            if (status !== 0) {
                                throw new Error(`Got error status while reading signature: ${status}`);
                            }

                            const body = decodeBuffer(response.slice(5, response.length));

                            const properties = body.get(
                                GattConstants.Types['HAP-Param-HAP-Characteristic-Properties-Descriptor'],
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
                                if (value & 0x0080 || value & 0x0100 || value & 0x0200) {
                                    entry.perms.push('ev');
                                    if (value & 0x0080) {
                                        entry.perms.push('ev-connected');
                                    }
                                    if (value & 0x0100) {
                                        entry.perms.push('ev-disconnected');
                                    }
                                    if (value & 0x0200) {
                                        entry.perms.push('ev-broadcast');
                                    }
                                }
                            }

                            const description = body.get(
                                GattConstants.Types['HAP-Param-GATT-User-Description-Descriptor'],
                            );
                            if (description && options.extra) {
                                entry.description = description.toString();
                            }

                            const format = body.get(
                                GattConstants.Types['HAP-Param-GATT-Presentation-Format-Descriptor'],
                            );
                            if (format && options.meta) {
                                const sigFormat = format.readUInt8(0);
                                const hapFormat = GattConstants.BTSigToHapFormat.get(sigFormat);
                                if (hapFormat) {
                                    entry.format = hapFormat;
                                }

                                const sigUnit = format.readUInt16LE(3);
                                const hapUnit = GattConstants.BTSigToHapUnit.get(sigUnit);
                                if (hapUnit) {
                                    entry.unit = hapUnit;
                                }
                            }

                            const validRange = body.get(GattConstants.Types['HAP-Param-GATT-Valid-Range']);

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
                                        entry.minValue = validRange.readUInt32LE(0) || validRange.readUInt32LE(4) << 32;
                                        entry.maxValue =
                                            validRange.readUInt32LE(8) || validRange.readUInt32LE(16) << 32;
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

                            const stepValue = body.get(GattConstants.Types['HAP-Param-HAP-Step-Value-Descriptor']);
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
                                        entry.minStep = stepValue.readUInt32LE(0) || stepValue.readUInt32LE(4) << 32;
                                        break;
                                    case 'int':
                                        entry.minStep = stepValue.readInt32LE(0);
                                        break;
                                    case 'float':
                                        entry.minStep = stepValue.readFloatLE(0);
                                        break;
                                }
                            }

                            const validValues = body.get(GattConstants.Types['HAP-Param-HAP-Valid-Values-Descriptor']);
                            if (validValues && options.extra) {
                                entry['valid-values'] = Array.from(validValues.values());
                            }

                            const validValuesRange = body.get(
                                GattConstants.Types['HAP-Param-HAP-Valid-Values-Range-Descriptor'],
                            );
                            if (validValuesRange && options.extra) {
                                entry['valid-values-range'] = Array.from(validValuesRange.values()).slice(0, 2);
                            }

                            entries.push(entry);
                        });
                    }

                    await lastOp;
                }

                const queue = new OpQueue();
                let lastOp = Promise.resolve();
                const updatedEntries: Characteristic.CharacteristicObject[] = [];

                for (const c of cList) {
                    const match = characteristics.find((ch) => {
                        return (
                            ch.serviceUuid === (<{ _serviceUuid: string }>(<unknown>c))._serviceUuid &&
                            ch.characteristicUuid === c.uuid
                        );
                    });

                    if (!match) {
                        continue;
                    }

                    const iid = match.iid;
                    const pdu = this.gattProtocol.buildCharacteristicReadRequest(this.getNextTransactionId(), iid);

                    let entry = entries.find((e) => e.iid === iid);
                    if (!entry) {
                        entry = { aid: 1, iid };
                    }

                    if (options.ev) {
                        entry!.ev = false;
                    }

                    if (options.type) {
                        entry!.type = GattUtils.nobleUuidToUuid(c.uuid);
                    }

                    if (options.extra) {
                        entry!.serviceUuid = GattUtils.nobleUuidToUuid(
                            (<{ _serviceUuid: string }>(<unknown>c))._serviceUuid,
                        );
                    }

                    lastOp = queue.queue(async () => {
                        try {
                            const pdus = await connection!.writeCharacteristic(c, [pdu]);
                            if (pdus.length === 0) {
                                return;
                            }

                            const response = pdus[0];
                            const body = decodeBuffer(response.slice(5, response.length));
                            const value = body.get(GattConstants.Types['HAP-Param-Value']);
                            if (!value) {
                                return;
                            }

                            if (entry!.format) {
                                entry!.value = GattUtils.bufferToValue(value, entry!.format);
                            } else if (match.format) {
                                entry!.value = GattUtils.bufferToValue(value, match.format);
                            }

                            updatedEntries.push(entry!);
                        } catch (_) {
                            // If an error occurs here, go ahead and push the entry without a
                            // value.
                            updatedEntries.push(entry!);
                        }
                    });
                }

                await lastOp;

                if (needToClose) {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    await connection!.disconnect().catch(() => {});
                }

                return { characteristics: updatedEntries };
            } catch (err) {
                if (needToClose) {
                    // eslint-disable-next-line @typescript-eslint/no-empty-function
                    await connection!.disconnect().catch(() => {});
                }

                throw err;
            }
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
     * @returns {Promise} Promise which resolves when the characteristics have been set.
     */
    setCharacteristics(
        values: { characteristicUuid: string; serviceUuid: string; iid: number; value: unknown }[],
    ): Promise<void> {
        return this._queueOperation(async () => {
            const connection = new GattConnection(this.peripheral);

            try {
                await connection.connect();

                await this._pairVerify(connection);

                for (const v of values) {
                    v.characteristicUuid = GattUtils.uuidToNobleUuid(v.characteristicUuid);
                    v.serviceUuid = GattUtils.uuidToNobleUuid(v.serviceUuid);
                }

                const { characteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
                        Array.from(new Set(values.map((c) => c.serviceUuid))),
                        Array.from(new Set(values.map((c) => c.characteristicUuid))),
                    ),
                ).getPromise();

                const queue = new OpQueue();
                let lastOp = Promise.resolve();

                for (const v of values) {
                    const characteristic = characteristics.find((c) => {
                        return (<{ _serviceUuid: string }>(<unknown>c))._serviceUuid === v.serviceUuid;
                    });

                    if (!characteristic) {
                        throw new Error(`Characteristic not found: ${JSON.stringify(v)}`);
                    }

                    const data = new Map();
                    data.set(GattConstants.Types['HAP-Param-Value'], v.value);
                    const pdu = this.gattProtocol.buildCharacteristicWriteRequest(
                        this.getNextTransactionId(),
                        v.iid,
                        data,
                    );

                    lastOp = queue.queue(async () => {
                        await connection.writeCharacteristic(characteristic, [pdu]);
                    });
                }

                await lastOp;

                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
            } catch (err) {
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                await connection.disconnect().catch(() => {});
                throw err;
            }
        });
    }

    /**
     * Subscribe to events for a set of characteristics.
     *
     * @fires HttpClient#event
     * @fires HttpClient#event-disconnect
     * @param {Object[]} characteristics - Characteristics to subscribe to, as a
     *                   list of objects:
     *                   {characteristicUuid, serviceUuid, iid, format}
     * @returns {Promise} Promise which resolves to the GattConnection object.
     */
    subscribeCharacteristics(characteristics: GattSubscriptionCharacteristicData[]): Promise<void> {
        return this._queueOperation(async () => {
            const newSubscriptions: GattSubscriptionCharacteristicData[] = [];
            for (const c of characteristics) {
                if (this.subscribedCharacteristics.find((char) => char.iid === c.iid)) {
                    // cid already subscribed, so we do not need to subscribe again
                    continue;
                }
                c.characteristicUuid = GattUtils.uuidToNobleUuid(c.characteristicUuid);
                c.serviceUuid = GattUtils.uuidToNobleUuid(c.serviceUuid);
                newSubscriptions.push(c);
            }

            if (newSubscriptions.length) {
                let connection: GattConnection;
                if (this.subscriptionConnection) {
                    connection = this.subscriptionConnection;
                } else {
                    connection = this.subscriptionConnection = new GattConnection(this.peripheral);
                    await connection.connect();
                    connection.once('disconnected', () => {
                        delete this.subscriptionConnection;
                        if (this.subscribedCharacteristics.length) {
                            /**
                             * Event emitted when subscription connection got disconnected, but
                             * still some characteristics are subscribed.
                             * You need to manually resubscribe!
                             *
                             * @event GattClient#event-disconnect
                             * @type {Object[]} List of the subscribed characteristics for resubscribe handling
                             */
                            this.emit('event-disconnect', this.subscribedCharacteristics);
                            this.subscribedCharacteristics = [];
                        }
                    });
                }

                await this._pairVerify(connection);

                const { characteristics: discoveredCharacteristics } = await new GattUtils.Watcher(
                    this.peripheral,
                    this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
                        Array.from(new Set(newSubscriptions.map((c) => c.serviceUuid))),
                        Array.from(new Set(newSubscriptions.map((c) => c.characteristicUuid))),
                    ),
                ).getPromise();

                const queue = new OpQueue();
                let lastOp = Promise.resolve();

                for (const c of newSubscriptions) {
                    const characteristic = discoveredCharacteristics.find((d) => {
                        return (
                            (<{ _serviceUuid: string }>(<unknown>d))._serviceUuid === c.serviceUuid &&
                            d.uuid === c.characteristicUuid
                        );
                    });

                    if (!characteristic) {
                        throw new Error(`Characteristic not found: ${JSON.stringify(c)}`);
                    }

                    if (!characteristic.properties.includes('indicate')) {
                        throw new Error(`Characteristic not available to subscribe: ${JSON.stringify(c)}`);
                    }

                    lastOp = queue.queue(async () => {
                        await new GattUtils.Watcher(this.peripheral, characteristic.subscribeAsync()).getPromise();
                    });

                    characteristic.on('data', async (data: Buffer) => {
                        // Indications come up as empty buffers. A characteristic read
                        // should be triggered when this happens.
                        if (Buffer.isBuffer(data) && data.length === 0) {
                            if (!this.subscriptionConnection) {
                                return;
                            }
                            try {
                                const res = await this.getCharacteristics([c], {}, this.subscriptionConnection);
                                /**
                                 * Event emitted with characteristic value changes
                                 *
                                 * @event GattClient#event
                                 */
                                this.emit('event', res);
                            } catch (err) {
                                // ignore
                            }
                        }
                    });
                }

                await lastOp;

                this.subscribedCharacteristics = this.subscribedCharacteristics.concat(newSubscriptions);
            }
        });
    }

    /**
     * Get the list of subscribed characteristics
     *
     * @returns {Object[]} Array with subscribed entries as objects with characteristics and service UUIDs and such
     */
    getSubscribedCharacteristics(): {
        characteristicUuid: string;
        serviceUuid: string;
        iid: number;
        format: string;
    }[] {
        return this.subscribedCharacteristics;
    }

    /**
     * Unsubscribe from events for a set of characteristics.
     *
     * @param {Object[]} characteristics - Characteristics to unsubscribe from, as
     *                   a list of objects: {characteristicUuid, serviceUuid},
     *                   if ommited all currently subscribed characteristics will be unsubscribed
     * @returns {Promise} Promise which resolves when the procedure is done.
     */
    async unsubscribeCharacteristics(
        characteristics?: { characteristicUuid: string; serviceUuid: string }[],
    ): Promise<void> {
        if (!this.subscriptionConnection || !this.subscribedCharacteristics.length) {
            return;
        }

        if (!characteristics) {
            characteristics = this.subscribedCharacteristics;
        }

        for (const c of characteristics) {
            c.characteristicUuid = GattUtils.uuidToNobleUuid(c.characteristicUuid);
            c.serviceUuid = GattUtils.uuidToNobleUuid(c.serviceUuid);
        }

        const { characteristics: discoveredCharacteristics } = await new GattUtils.Watcher(
            this.peripheral,
            this.peripheral.discoverSomeServicesAndCharacteristicsAsync(
                Array.from(new Set(characteristics.map((c) => c.serviceUuid))),
                Array.from(new Set(characteristics.map((c) => c.characteristicUuid))),
            ),
        ).getPromise();

        const queue = new OpQueue();
        let lastOp = Promise.resolve();

        for (const c of characteristics) {
            const characteristic = discoveredCharacteristics.find((d) => {
                return (
                    (<{ _serviceUuid: string }>(<unknown>d))._serviceUuid === c.serviceUuid &&
                    d.uuid === c.characteristicUuid
                );
            });

            if (!characteristic) {
                throw new Error(`Characteristic not found: ${JSON.stringify(c)}`);
            }

            lastOp = queue.queue(async () => {
                await new GattUtils.Watcher(this.peripheral, characteristic.unsubscribeAsync()).getPromise();
            });
        }

        await lastOp;

        if (!this.subscribedCharacteristics.length) {
            this.subscriptionConnection.disconnect().catch(() => {
                // ignore
            });
            delete this.subscriptionConnection;
        }
    }

    /**
     * Close all potential still open connections
     *
     * @returns {Promise<void>} Promise when done
     */
    async close(): Promise<void> {
        try {
            await this._pairingConnection?.disconnect();
        } catch {
            // ignore
        }
        delete this._pairingConnection;
        try {
            await this.subscriptionConnection?.disconnect();
        } catch {
            // ignore
        }
        delete this.subscriptionConnection;
        this.subscribedCharacteristics = [];
    }
}
