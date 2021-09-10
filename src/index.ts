import BLEDiscovery, { HapServiceBle } from './transport/ble/ble-discovery';
import GattClient from './transport/ble/gatt-client';
import HttpClient from './transport/ip/http-client';
import { PairMethods, PairingTypeFlags, PairingData } from './protocol/pairing-protocol';
import IPDiscovery, { HapServiceIp } from './transport/ip/ip-discovery';
import * as Category from './model/category';
import * as Characteristic from './model/characteristic';
import * as GattConstants from './transport/ble/gatt-constants';
import * as GattUtils from './transport/ble/gatt-utils';
import * as HttpConstants from './transport/ip/http-constants';
import * as Service from './model/service';
import * as TLV from './model/tlv';

class HomekitControllerError extends Error {
    public statusCode: number | undefined;

    public body: Record<string, unknown> | undefined;

    constructor(message: string, statusCode?: number, body?: Record<string, unknown> | Buffer) {
        super(message);
        // eslint-disable-next-line no-undefined
        if (statusCode !== undefined) {
            this.setStatusCode(statusCode);
        }
        // eslint-disable-next-line no-undefined
        if (body !== undefined) {
            this.setBody(body);
        }
    }

    setStatusCode(errorCode: number): void {
        this.statusCode = errorCode;
    }

    getStatusCode(): number | undefined {
        return this.statusCode;
    }

    setBody(body: Record<string, unknown> | Buffer): void {
        if (Buffer.isBuffer(body)) {
            try {
                this.body = JSON.parse(body.toString('utf-8'));
            } catch (err) {
                this.body = {
                    raw: body,
                };
            }
        } else {
            this.body = body;
        }
    }

    getBody(): Record<string, unknown> | undefined {
        return this.body;
    }
}

export {
    BLEDiscovery,
    HapServiceBle,
    Category,
    Characteristic,
    GattClient,
    GattConstants,
    GattUtils,
    HttpClient,
    HttpConstants,
    IPDiscovery,
    HapServiceIp,
    Service,
    TLV,
    PairMethods,
    PairingTypeFlags,
    PairingData,
    HomekitControllerError,
};
