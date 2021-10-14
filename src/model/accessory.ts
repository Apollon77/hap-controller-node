import { ServiceObject } from './service';

/**
 * Accessory characteristic types.
 *
 * See Chapter 8
 */
export interface Accessories {
    accessories: AccessoryObject[];
}

export interface AccessoryObject {
    aid: number;
    services: ServiceObject[];
}
