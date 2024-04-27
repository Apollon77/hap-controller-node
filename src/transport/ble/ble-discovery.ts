/**
 * BLE discovery wrappers for finding HAP devices.
 */

import { EventEmitter } from 'events';
import { Peripheral } from '@abandonware/noble';
import GattClient from './gatt-client';
import Debug from 'debug';

let noble: typeof import('@abandonware/noble');
noble = require('@abandonware/noble');
if (typeof noble.on !== 'function') {
    // The following commit broke the default exported instance of noble:
    // https://github.com/abandonware/noble/commit/b67eea246f719947fc45b1b52b856e61637a8a8e
    noble = (noble as any)({ extended: false });
}
const debug = Debug('hap-controller:gatt-client');

/**
 * See Table 7-43
 */
const DiscoveryPairingStatusFlags = {
    AccessoryNotPaired: 0x01,
};

export { DiscoveryPairingStatusFlags };

export interface HapServiceBle {
    name: string;
    /**
     * CoID: Company Identifier code, 0x004C (Apple,Inc.) ,in little endian format.
     */
    CoID: number;
    /**
     * TY: 8 bits for Type,which shall be set to 0x11
     */
    TY: number;
    /**
     * STL: 8 bits for Sub Type and Length
     *
     * From Specs:
     * The 3 significant bits specify the HomeKit advertising
     * format Sub Type and shall be set to 1, and the remaining 5 bits is the length of the remaining
     * bytes in the manufacturer specific data which shall be set to the value 17.
     */
    AIL: number;
    /**
     * SF: 8 bits for Status Flags
     *
     * From Specs:
     * Bits 1-7 are reserved and shall be set to 0, Bit 0 shall reflect the value of the HAP Pairing
     * Status Flag.
     * see DiscoveryPairingStatusFlags
     */
    SF: number;
    /**
     * Device-ID: 48-bit Device ID (”5.4 DeviceID” (page31)) of the accessory.
     */
    DeviceID: string;
    /**
     * ACID: Accessory Category Identifier
     *
     * From Specs:
     * 16-bit little endian unsigned Accessory Category Identifier,which indicates the category that
     * best describes the primary function of the accessory. This must have a range of 1-65535. This
     * must take one of the values defined in the ”13-1 Accessory Categories” (page 252).
     * The Category Identifier must not change except during a firmware update.
     */
    ACID: number;
    /**
     * GSN: 16-bit little endian unsigned Global State Number.
     *
     * From Specs:
     * The Global State Number represents the state at which a required change on the accessory was
     * last notified to the HomeKit controller. Accessories shall maintain a 16 bit monotonically
     * increasing GSN value. This value must have a range of 1-65535 and wrap to 1 when it overflows.
     * This value must persist across reboots, power cycles, etc. This value must be reset back to 1
     * when factory reset or a firmware update occurs on the accessory. For more details see
     * ”7.4.6 HAP Notifications” (page 127)
     */
    GSN: number;
    /**
     * CN: Configuration Number
     *
     * From Specs:
     * 8 bits for Configuration Number, with a default starting value of 1. Accessories must
     * increment the config number after a firmware update. This value must have a range of 1-255
     * and wrap to 1 when it overflows. This value must persist across reboots, power cycles and
     * firmware updates.
     */
    CN: number;
    /**
     * CV: 8bit little endian Compatible Version
     *
     * From Specs:
     * This value shall be set to 0x02 for this version of the HAP BLE.
     */
    CV: number;
    /**
     * Added in v2 of the HAP specifications but no details known
     * SH: 4byte little endian Setup Hash to support enhanced setup payload information
     * (see”????”(page??))
     */
    // SH: string;
    /**
     * Peripheral object used for all communication to this device
     */
    peripheral: Peripheral;
    /**
     * c#: the configuration number, same value as CN for convenient reasons with IP
     */
    'c#': number;
    /**
     * id: the deviceId, same value as deviceId for convenient reasons with IP
     */
    id: string;
    /**
     * ci: the category identifier, same value as ACID for convenient reasons with IP
     */
    ci: number;
    /**
     * availableToPair: is the device available for pairing?
     */
    availableToPair: boolean;
}

/**
 * Handle discovery of IP devices
 *
 * @fires BLEDiscovery#serviceUp
 * @fires BLEDiscovery#serviceChanged
 */
export default class BLEDiscovery extends EventEmitter {
    private scanEnabled: boolean;

    private allowDuplicates: boolean;

    private services: Map<string, HapServiceBle>;

    private handleStateChange: (state: string) => void;

    private handleDiscover: (peripheral: Peripheral) => void;

    private handleScanStart: () => void;

    private handleScanStop: () => void;

    constructor() {
        super();

        this.scanEnabled = false;
        this.allowDuplicates = false;

        this.services = new Map();

        this.handleStateChange = this._handleStateChange.bind(this);
        this.handleDiscover = this._handleDiscover.bind(this);
        this.handleScanStart = this._handleScanStart.bind(this);
        this.handleScanStop = this._handleScanStop.bind(this);
    }

    /**
     * Start searching for BLE HAP devices.
     *
     * @param {boolean} allowDuplicates - Deprecated, use new serviceChanged event instead.
     *                  Allow duplicate serviceUp events. This
     *                  is needed for disconnected events, where the GSN is
     *                  updated in the advertisement.
     */
    start(allowDuplicates = false): void {
        this.scanEnabled = true;
        this.allowDuplicates = allowDuplicates;

        noble.on('stateChange', this.handleStateChange);
        noble.on('scanStart', this.handleScanStart);
        noble.on('scanStop', this.handleScanStop);
        noble.on('discover', this.handleDiscover);

        // Only manually start if powered on already. Otherwise, wait for state
        // change and handle it there.
        if (noble._state === 'poweredOn') {
            noble.startScanning([], true);
        }
    }

    /**
     * Get PairMethod to use for pairing from the data received during discovery
     *
     * @param {HapServiceBle} service Discovered service object to check
     * @returns {Promise<number>} Promise which resolves with the PairMethod to use
     */
    public async getPairMethod(service: HapServiceBle): Promise<number> {
        const client = new GattClient(service.DeviceID, service.peripheral);
        return client.getPairingMethod();
    }

    /**
     * List the currently known services.
     *
     * @returns {Object[]} Array of services
     */
    list(): HapServiceBle[] {
        return Array.from(this.services.values());
    }

    /**
     * Stop an ongoing discovery process.
     */
    stop(): void {
        this.scanEnabled = false;
        noble.stopScanning();
        noble.removeListener('stateChange', this.handleStateChange);
        noble.removeListener('scanStart', this.handleScanStart);
        noble.removeListener('scanStop', this.handleScanStop);
        noble.removeListener('discover', this.handleDiscover);
    }

    private _handleStateChange(state: string): void {
        if (state === 'poweredOn' && this.scanEnabled) {
            noble.startScanning([], true);
        } else {
            noble.stopScanning();
        }
    }

    private _handleScanStart(): void {
        if (!this.scanEnabled) {
            noble.stopScanning();
        }
    }

    private _handleScanStop(): void {
        if (this.scanEnabled && noble._state === 'poweredOn') {
            noble.startScanning([], true);
        }
    }

    private _handleDiscover(peripheral: Peripheral): void {
        const advertisement = peripheral.advertisement;
        const manufacturerData = advertisement.manufacturerData;

        if (!advertisement || !advertisement.localName || !manufacturerData || manufacturerData.length < 17) {
            return;
        }

        // See Chapter 6.4.2.2
        const localName = advertisement.localName;
        const CoID = manufacturerData.readUInt16LE(0);
        const TY = manufacturerData.readUInt8(2);
        const AIL = manufacturerData.readUInt8(3);
        const SF = manufacturerData.readUInt8(4);
        const deviceID = manufacturerData.slice(5, 11);
        const ACID = manufacturerData.readUInt16LE(11);
        const GSN = manufacturerData.readUInt16LE(13);
        const CN = manufacturerData.readUInt8(15);
        const CV = manufacturerData.readUInt8(16);
        // const SH = manufacturerData.length > 17 ? manufacturerData.slice(17, 21) : Buffer.alloc(0);

        if (TY === 0x11) {
            debug(`Encrypted Broadcast detected ... ignoring for now: ${manufacturerData}`);
        }
        if (CoID !== 0x4c || TY !== 0x06 || CV !== 0x02) {
            return;
        }

        let formattedId = '';
        for (const b of deviceID) {
            formattedId += `${b.toString(16).padStart(2, '0')}:`;
        }
        formattedId = formattedId.substr(0, 17);

        const service = {
            name: localName,
            CoID,
            TY,
            AIL,
            SF,
            DeviceID: formattedId,
            ACID,
            GSN,
            CN,
            CV,
            peripheral,
            // SH,
            'c#': CN,
            id: formattedId,
            ci: ACID,
            availableToPair: !!(SF & DiscoveryPairingStatusFlags.AccessoryNotPaired),
        };

        const formerService = this.services.get(service.DeviceID);
        this.services.set(service.DeviceID, service);
        if (formerService && !this.allowDuplicates) {
            for (const el of Object.keys(service) as (keyof HapServiceBle)[]) {
                if (el !== 'peripheral' && el !== 'name' && formerService[el] !== service[el]) {
                    /**
                     * Device data changed event
                     *
                     * @event BLEDiscovery#serviceChanged
                     * @type HapServiceBle
                     */
                    this.emit('serviceChanged', service);
                    break;
                }
            }
        } else {
            /**
             * New device discovered event
             *
             * @event BLEDiscovery#serviceUp
             * @type HapServiceBle
             */
            this.emit('serviceUp', service);
        }
    }
}
