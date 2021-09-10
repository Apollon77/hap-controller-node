/**
 * Controller class for interacting with a HAP device over HTTP.
 */

import { EventEmitter } from 'events';
import HttpConnection from './http-connection';
import PairingProtocol, { PairingData, SessionKeys, PairMethods } from '../../protocol/pairing-protocol';
import { TLV } from '../../model/tlv';
import Debug from 'debug';
import * as Characteristic from '../../model/characteristic';
import * as Service from '../../model/service';
import { HomekitControllerError } from '../../index';

const debug = Debug('hap-controller:http-client');

export interface GetCharacteristicsOptions {
    /**
     * Boolean value that determines whether or not the response should include metadata.
     * If true the response must include the following properties if they exist for the
     * characteristic: ”format”, ”unit”, ”minValue”, ”maxValue”, ”minStep”, and ”maxLen”.
     * Default: false
     */
    meta?: boolean;

    /**
     * Boolean value that determines whether or not the response should include the permissions
     * of the characteristic.
     * Default: false
     */
    perms?: boolean;

    /**
     * Boolean value that determines whether or not the response should include the type of characteristic.
     * Default: false
     */
    type?: boolean;

    /**
     * Boolean value that determines whether or not the ”ev” property of the characteristic should be
     * included in the response
     * Default: false
     */
    ev?: boolean;
}

export interface SetCharacteristicsObject {
    /**
     * The instance ID of the accessory that contains the characteristic to be written.
     */
    aid?: number;

    /**
     * The instance ID of the characteristic to be written.
     */
    iid?: number;

    /**
     * Property that contains the value to be written to the characteristic. Required
     */
    value: unknown;

    /**
     * Optional property that contains a base 64 encoded string of the authorization data
     * associated with the characteristic.
     */
    authData?: string;

    /**
     * Optional property that indicates if remote access was used to send the request.
     * A value of true indicates remote access was used.
     */
    remote?: boolean;

    /**
     * Optional property that indicates whether a value is expected in the response to the
     * write operation.
     */
    r?: boolean;
}

interface WriteCharacteristicsObject extends SetCharacteristicsObject {
    /**
     * The instance ID of the accessory that contains the characteristic to be written.
     */
    aid?: number;

    /**
     * The instance ID of the characteristic to be written.
     */
    iid?: number;
}

interface EventCharacteristicsObject {
    /**
     * The instance ID of the accessory that contains the characteristic to be written.
     */
    aid: number;

    /**
     * The instance ID of the characteristic to be written.
     */
    iid: number;

    /**
     * Property that indicates the state of event notifications for the characteristic.
     */
    ev: boolean;
}

export default class HttpClient extends EventEmitter {
    deviceId: string;

    private address: string;

    private port: number;

    private pairingProtocol: PairingProtocol;

    private _pairingConnection?: HttpConnection;

    /**
     * Initialize the HttpClient object.
     *
     * @param {string} deviceId - ID of the device
     * @param {string} address - IP address of the device
     * @param {number} port - HTTP port
     * @param {PairingData?} pairingData - existing pairing data
     */
    constructor(deviceId: string, address: string, port: number, pairingData?: PairingData) {
        super();
        this.deviceId = deviceId;
        this.address = address;
        this.port = port;
        this.pairingProtocol = new PairingProtocol(pairingData);
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
     * Run the identify routine on a device.
     *
     * This can only be done before pairing.
     * If the device is already paired the method returns an error (Identify failed with status 400)
     *
     * @returns {Promise} Promise which resolves if identify succeeded.
     */
    async identify(): Promise<void> {
        const connection = new HttpConnection(this.address, this.port);
        const response = await connection.post('/identify', Buffer.alloc(0));
        connection.close();

        if (response.statusCode !== 204) {
            throw new HomekitControllerError(
                `Identify failed with status ${response.statusCode}`,
                response.statusCode,
                response.body
            );
        }
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
     * @returns {Promise} Promise which resolves to opaque pairing data when complete.
     */
    async startPairing(pairMethod = PairMethods.PairSetupWithAuth, pairFlags = 0): Promise<TLV> {
        const connection = (this._pairingConnection = new HttpConnection(this.address, this.port));

        // M1
        const m1 = await this.pairingProtocol.buildPairSetupM1(pairMethod, pairFlags);
        const m2 = await connection.post('/pair-setup', m1, 'application/pairing+tlv8');

        // M2
        return this.pairingProtocol.parsePairSetupM2(m2.body);
    }

    /**
     * Finishes a pairing process that began with startPairing()
     *
     * @param {TLV} pairingData - The pairing data returned from startPairing()
     * @param {string} pin - The pairing PIN, needs to be formatted as XXX-XX-XXX
     * @returns {Promise} Promise which resolve when pairing is complete.
     */
    async finishPairing(pairingData: TLV, pin: string): Promise<void> {
        if (!pairingData || !this._pairingConnection) {
            throw new Error('Must call startPairing() first');
        }

        this.verifyPin(pin);

        const connection = this._pairingConnection;
        delete this._pairingConnection;

        // M3
        const m3 = await this.pairingProtocol.buildPairSetupM3(pairingData, pin);
        const m4 = await connection.post('/pair-setup', m3, 'application/pairing+tlv8');

        // M4
        await this.pairingProtocol.parsePairSetupM4(m4.body);

        if (!this.pairingProtocol.isTransientOnlyPairSetup()) {
            // According to specs for a transient pairSetup process no M5/6 is done, which should end in a
            // "non pairing" result and we miss AccessoryId and AccessoryLTPK, but the current session is
            // authenticated

            // M5
            const m5 = await this.pairingProtocol.buildPairSetupM5();
            const m6 = await connection.post('/pair-setup', m5, 'application/pairing+tlv8');

            // M6
            await this.pairingProtocol.parsePairSetupM6(m6.body);
        }
        await connection.close();
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
        await this.finishPairing(await this.startPairing(pairMethod, pairFlags), pin);
    }

    /**
     * Method used internally to generate session keys for a connection.
     *
     * @private
     * @param {Object} connection - Existing HttpConnection object
     * @returns {Promise} Promise which resolves to the generated session keys.
     */
    private async _pairVerify(connection: HttpConnection): Promise<SessionKeys> {
        // M1
        const m1 = await this.pairingProtocol.buildPairVerifyM1();
        const m2 = await connection.post('/pair-verify', m1, 'application/pairing+tlv8');

        // M2
        await this.pairingProtocol.parsePairVerifyM2(m2.body);

        // M3
        const m3 = await this.pairingProtocol.buildPairVerifyM3();
        const m4 = await connection.post('/pair-verify', m3, 'application/pairing+tlv8');

        // M4
        await this.pairingProtocol.parsePairVerifyM4(m4.body);

        return this.pairingProtocol.getSessionKeys();
    }

    /**
     * Unpair the controller from a device.
     *
     * @param {string | Buffer} identifier - Identifier of the controller to remove
     * @returns {Promise} Promise which resolves when the process completes.
     */
    async removePairing(identifier: string | Buffer): Promise<void> {
        const connection = new HttpConnection(this.address, this.port);
        const keys = await this._pairVerify(connection);
        connection.setSessionKeys(keys);

        if (typeof identifier === 'string') {
            identifier = PairingProtocol.bufferFromHex(identifier);
        }

        // M1
        const m1 = await this.pairingProtocol.buildRemovePairingM1(identifier);
        const m2 = await connection.post('/pairings', m1, 'application/pairing+tlv8');

        // M2
        await this.pairingProtocol.parseRemovePairingM2(m2.body);

        connection.close();
    }

    /**
     * Add a pairing to a device.
     *
     * @param {string} identifier - Identifier of new controller
     * @param {Buffer} ltpk - Long-term public key of the new controller
     * @param {boolean} isAdmin - Whether or not the new controller is an admin
     * @returns {Promise} Promise which resolves when the process is complete.
     */
    async addPairing(identifier: string, ltpk: Buffer, isAdmin: boolean): Promise<void> {
        const connection = new HttpConnection(this.address, this.port);
        const keys = await this._pairVerify(connection);
        connection.setSessionKeys(keys);

        // M1
        const m1 = await this.pairingProtocol.buildAddPairingM1(identifier, ltpk, isAdmin);
        const m2 = await connection.post('/pairings', m1, 'application/pairing+tlv8');

        // M2
        await this.pairingProtocol.parseAddPairingM2(m2.body);

        connection.close();
    }

    /**
     * List the pairings on a device.
     *
     * @returns {Promise} Promise which resolves to the final TLV when the process
     *                    is complete.
     */
    async listPairings(): Promise<TLV> {
        const connection = new HttpConnection(this.address, this.port);
        const keys = await this._pairVerify(connection);
        connection.setSessionKeys(keys);

        // M1
        const m1 = await this.pairingProtocol.buildListPairingsM1();
        const m2 = await connection.post('/pairings', m1, 'application/pairing+tlv8');

        // M2
        const tlv = this.pairingProtocol.parseListPairingsM2(m2.body);

        connection.close();

        return tlv;
    }

    /**
     * Get the accessory attribute database from a device.
     *
     * @returns {Promise} Promise which resolves to the JSON document.
     */
    async getAccessories(): Promise<Characteristic.Accessories> {
        const connection = new HttpConnection(this.address, this.port);
        const keys = await this._pairVerify(connection);
        connection.setSessionKeys(keys);

        const response = await connection.get('/accessories');
        connection.close();

        if (response.statusCode !== 200) {
            throw new HomekitControllerError(
                `Get failed with status ${response.statusCode}`,
                response.statusCode,
                response.body
            );
        }

        return JSON.parse(response.body.toString());
    }

    /**
     * Read a set of characteristics.
     *
     * @param {string[]} characteristics - List of characteristics ID to get in form ["aid.iid", ...]
     * @param {GetCharacteristicsOptions?} options - Options dictating what metadata to fetch
     * @returns {Promise} Promise which resolves to the JSON document.
     */
    async getCharacteristics(
        characteristics: string[],
        options: GetCharacteristicsOptions = {}
    ): Promise<{ characteristics: Characteristic.CharacteristicObject[] }> {
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
        const keys = await this._pairVerify(connection);
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

        const response = await connection.get(path);
        connection.close();

        if (response.statusCode !== 200 && response.statusCode !== 207) {
            throw new HomekitControllerError(
                `Get failed with status ${response.statusCode}`,
                response.statusCode,
                response.body
            );
        }

        return JSON.parse(response.body.toString());
    }

    /**
     * Modify a set of characteristics.
     *
     * @param {Object} characteristics - Characteristic IDs to set in form id -> val
     * @returns {Promise} Promise which resolves to the JSON document.
     */
    async setCharacteristics(characteristics: Record<string, unknown>): Promise<Record<string, unknown>> {
        const connection = new HttpConnection(this.address, this.port);
        const data = {
            characteristics: <WriteCharacteristicsObject[]>[],
        };

        const keys = await this._pairVerify(connection);
        connection.setSessionKeys(keys);

        for (const cid in characteristics) {
            const parts = cid.split('.');

            let dataObject: WriteCharacteristicsObject = {
                aid: parseInt(parts[0], 10),
                iid: parseInt(parts[1], 10),
                value: characteristics[cid],
            });
        }

        const response = await connection.put('/characteristics', Buffer.from(JSON.stringify(data)));
        connection.close();

        if (response.statusCode === 204) {
            return data;
        } else if (response.statusCode === 207) {
            return JSON.parse(response.body.toString());
        } else {
            throw new HomekitControllerError(
                `Set failed with status ${response.statusCode}`,
                response.statusCode,
                response.body
            );
        }
    }

    /**
     * Subscribe to events for a set of characteristics.
     *
     * @fires HttpClient#event
     * @fires HttpClient#disconnect
     * @param {String[]} characteristics - List of characteristic IDs to subscribe to,
     *                                       in form ["iid.aid", ...]
     * @returns {Promise} Promise which resolves to the HttpConnection object.
     */
    async subscribeCharacteristics(characteristics: string[]): Promise<HttpConnection> {
        const connection = new HttpConnection(this.address, this.port);
        const data = {
            characteristics: <EventCharacteristicsObject[]>[],
        };

        const keys = await this._pairVerify(connection);
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
            /**
             * Event emitted with characteristic value changes
             *
             * @event HttpClient#event
             */
            this.emit('event', JSON.parse(ev));
        });

        connection.on('disconnect', () => {
            /**
             * Event emitted when subscription connection got disconnected.
             * You need to manually resubscribe!
             *
             * @event HttpClient#disconnect
             */
            this.emit('disconnect', {});
        });

        const response = await connection.put(
            '/characteristics',
            Buffer.from(JSON.stringify(data)),
            'application/hap+json',
            true
        );

        if (response.statusCode !== 204 && response.statusCode !== 207) {
            throw new Error(`Subscribe failed with status ${response.statusCode}`);
        }

        return connection;
    }

    /**
     * Unsubscribe from events for a set of characteristics.
     *
     * @param {String[]} characteristics - List of characteristic IDs to
     *                   unsubscribe from
     * @param {HttpConnection} connection - Existing HttpConnection object
     * @returns {Promise} Promise which resolves when the procedure is done.
     */
    async unsubscribeCharacteristics(characteristics: string[], connection: HttpConnection): Promise<void> {
        const data = {
            characteristics: <{ aid: number; iid: number; ev: boolean }[]>[],
        };

        for (const cid of characteristics) {
            const parts = cid.split('.');
            data.characteristics.push({
                aid: parseInt(parts[0], 10),
                iid: parseInt(parts[1], 10),
                ev: false,
            });
        }

        const response = await connection.put('/characteristics', Buffer.from(JSON.stringify(data)));

        if (response.statusCode !== 204 && response.statusCode !== 207) {
            throw new Error(`Unsubscribe failed with status ${response.statusCode}`);
        }
    }

    /**
     * Support for Get Image requests
     *
     * @param accessory
     * @param width
     * @param height
     */
    async getImage(accessory: number, width: number, height: number) {
        const connection = new HttpConnection(this.address, this.port);
        const data = {
            aid: accessory,
            'resource-type': 'image',
            'image-width': width,
            'image-height': height,
        };

        const keys = await this._pairVerify(connection);
        connection.setSessionKeys(keys);

        const response = await connection.post('/resource', Buffer.from(JSON.stringify(data)));
        connection.close();

        if (response.statusCode !== 200) {
            throw new HomekitControllerError(
                `Image request errored with status ${response.statusCode}`,
                response.statusCode,
                response.body
            );
        }

        return response.body;
    }
}
