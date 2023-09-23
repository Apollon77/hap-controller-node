/**
 * Service types.
 *
 * See Chapters 6 and 9.
 */

import { CharacteristicObject } from './characteristic';

export interface ServiceObject {
    iid: number;
    type: string;
    characteristics: CharacteristicObject[];
    primary?: boolean;
    hidden?: boolean;
    linked?: number[];
}

const UuidSuffix = '-0000-1000-8000-0026BB765291';

const ServiceMapByUuid: { [key: string]: string } = {
    [`0000003E${UuidSuffix}`]: 'public.hap.service.accessory-information',
    [`00000040${UuidSuffix}`]: 'public.hap.service.fan',
    [`00000041${UuidSuffix}`]: 'public.hap.service.garage-door-opener',
    [`00000043${UuidSuffix}`]: 'public.hap.service.lightbulb',
    [`00000044${UuidSuffix}`]: 'public.hap.service.lock-management',
    [`00000045${UuidSuffix}`]: 'public.hap.service.lock-mechanism',
    [`00000047${UuidSuffix}`]: 'public.hap.service.outlet',
    [`00000049${UuidSuffix}`]: 'public.hap.service.switch',
    [`0000004A${UuidSuffix}`]: 'public.hap.service.thermostat',
    [`00000055${UuidSuffix}`]: 'public.hap.service.pairing',
    [`00000056${UuidSuffix}`]: 'public.hap.service.tunneled-btle-accessory',
    [`0000005A${UuidSuffix}`]: 'public.hap.service.relay',
    [`00000062${UuidSuffix}`]: 'public.hap.service.bridging-state',
    [`0000007E${UuidSuffix}`]: 'public.hap.service.security-system',
    [`0000007F${UuidSuffix}`]: 'public.hap.service.sensor.carbon-monoxide',
    [`00000080${UuidSuffix}`]: 'public.hap.service.sensor.contact',
    [`00000081${UuidSuffix}`]: 'public.hap.service.door',
    [`00000082${UuidSuffix}`]: 'public.hap.service.sensor.humidity',
    [`00000083${UuidSuffix}`]: 'public.hap.service.sensor.leak',
    [`00000084${UuidSuffix}`]: 'public.hap.service.sensor.light',
    [`00000085${UuidSuffix}`]: 'public.hap.service.sensor.motion',
    [`00000086${UuidSuffix}`]: 'public.hap.service.sensor.occupancy',
    [`00000087${UuidSuffix}`]: 'public.hap.service.sensor.smoke',
    [`00000088${UuidSuffix}`]: 'public.hap.service.stateful-programmable-switch',
    [`00000089${UuidSuffix}`]: 'public.hap.service.stateless-programmable-switch',
    [`0000008A${UuidSuffix}`]: 'public.hap.service.sensor.temperature',
    [`0000008B${UuidSuffix}`]: 'public.hap.service.window',
    [`0000008C${UuidSuffix}`]: 'public.hap.service.window-covering',
    [`0000008D${UuidSuffix}`]: 'public.hap.service.sensor.air-quality',
    [`00000096${UuidSuffix}`]: 'public.hap.service.battery',
    [`00000097${UuidSuffix}`]: 'public.hap.service.sensor.carbon-dioxide',
    [`00000099${UuidSuffix}`]: 'public.hap.service.time-information',
    [`000000A1${UuidSuffix}`]: 'public.hap.service.bridge-configuration',
    [`000000A2${UuidSuffix}`]: 'public.hap.service.protocol.information.service',
    [`000000B7${UuidSuffix}`]: 'public.hap.service.fanv2',
    [`000000B9${UuidSuffix}`]: 'public.hap.service.vertical-slat',
    [`000000BA${UuidSuffix}`]: 'public.hap.service.filter-maintenance',
    [`000000BB${UuidSuffix}`]: 'public.hap.service.air-purifier',
    [`000000BC${UuidSuffix}`]: 'public.hap.service.heater-cooler',
    [`000000BD${UuidSuffix}`]: 'public.hap.service.humidifier-dehumidifier',
    [`000000CC${UuidSuffix}`]: 'public.hap.service.service-label',
    [`000000CF${UuidSuffix}`]: 'public.hap.service.irrigation-system',
    [`000000D0${UuidSuffix}`]: 'public.hap.service.valve',
    [`000000D7${UuidSuffix}`]: 'public.hap.service.faucet',
    [`000000D8${UuidSuffix}`]: 'public.hap.service.television',
    [`000000D9${UuidSuffix}`]: 'public.hap.service.input-source',
    [`000000DA${UuidSuffix}`]: 'public.hap.service.access-control',
    [`00000110${UuidSuffix}`]: 'public.hap.service.camera-rtp-stream-management',
    [`00000111${UuidSuffix}`]: 'public.hap.service.camera-control',
    [`00000112${UuidSuffix}`]: 'public.hap.service.microphone',
    [`00000113${UuidSuffix}`]: 'public.hap.service.speaker',
    [`00000121${UuidSuffix}`]: 'public.hap.service.doorbell',
    [`00000122${UuidSuffix}`]: 'public.hap.service.target-control-management',
    [`00000125${UuidSuffix}`]: 'public.hap.service.target-control',
    [`00000127${UuidSuffix}`]: 'public.hap.service.audio-stream-management',
    [`00000129${UuidSuffix}`]: 'public.hap.service.data-stream-transport-management',
    [`00000133${UuidSuffix}`]: 'public.hap.service.siri',
    [`00000203${UuidSuffix}`]: 'public.hap.service.transfer-transport-management',
    [`00000204${UuidSuffix}`]: 'public.hap.service.camera-recording-management',
    [`0000020A${UuidSuffix}`]: 'public.hap.service.wifi-router',
    [`0000020F${UuidSuffix}`]: 'public.hap.service.wifi-satellite',
    [`0000021A${UuidSuffix}`]: 'public.hap.service.camera-operating-mode',
    [`00000221${UuidSuffix}`]: 'public.hap.service.power-management',
    [`00000228${UuidSuffix}`]: 'public.hap.service.smart-speaker',
    [`0000022A${UuidSuffix}`]: 'public.hap.service.wifi-transport',
    [`00000237${UuidSuffix}`]: 'public.hap.service.diagnostics',
    [`00000239${UuidSuffix}`]: 'public.hap.service.accessory-runtime-information',
    [`00000253${UuidSuffix}`]: 'public.hap.service.siri-endpoint',
    [`00000260${UuidSuffix}`]: 'public.hap.service.access-code', // since iOS 15
    [`00000266${UuidSuffix}`]: 'public.hap.service.nfc-access', // since iOS 15
    [`00000267${UuidSuffix}`]: 'public.hap.service.asset-update',
    [`0000026A${UuidSuffix}`]: 'public.hap.service.assistant',
    [`00000270${UuidSuffix}`]: 'public.hap.service.accessory-metrics',
    [`00000701${UuidSuffix}`]: 'public.hap.service.thread-transport',
};

const ServiceMapByService = Object.assign({}, ...Object.entries(ServiceMapByUuid).map(([a, b]) => ({ [b]: a })));

/**
 * Ensure the type is a valid service UUID, also when short representations is used
 *
 * @param {string} uuid - Service UUID
 * @returns {string} Service UUID as UUID
 */
export function ensureServiceUuid(uuid: string): string {
    if (uuid.length <= 8) {
        uuid = `${uuid.padStart(8, '0')}${UuidSuffix}`;
    }

    uuid = uuid.toUpperCase();

    return uuid;
}

/**
 * Get a service name from its UUID.
 *
 * @param {string} uuid - Service UUID
 * @returns {string} Service name
 */
export function serviceFromUuid(uuid: string): string {
    uuid = ensureServiceUuid(uuid);

    return ServiceMapByUuid[uuid] || uuid;
}

/**
 * Get a service UUID from its name.
 *
 * @param {string} service - Service name
 * @returns {string} Service UUID
 */
export function uuidFromService(service: string): string {
    return ServiceMapByService[service] || service;
}
