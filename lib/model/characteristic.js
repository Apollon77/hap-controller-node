/**
 * Accessory characteristic types.
 *
 * See Chapter 8
 */
/* eslint-disable max-len */
'use strict';

const UuidSuffix = '-0000-1000-8000-0026BB765291';
const CharacteristicMapByUuid = {
  [`00000001${UuidSuffix}`]: 'public.hap.characteristic.administrator-only-access',
  [`00000005${UuidSuffix}`]: 'public.hap.characteristic.audio-feedback',
  [`00000008${UuidSuffix}`]: 'public.hap.characteristic.brightness',
  [`0000000D${UuidSuffix}`]: 'public.hap.characteristic.temperature.cooling-threshold',
  [`0000000E${UuidSuffix}`]: 'public.hap.characteristic.door-state.current',
  [`0000000F${UuidSuffix}`]: 'public.hap.characteristic.heating-cooling.current',
  [`00000010${UuidSuffix}`]: 'public.hap.characteristic.relative-humidity.current',
  [`00000011${UuidSuffix}`]: 'public.hap.characteristic.temperature.current',
  [`00000012${UuidSuffix}`]: 'public.hap.characteristic.temperature.heating-threshold',
  [`00000013${UuidSuffix}`]: 'public.hap.characteristic.hue',
  [`00000014${UuidSuffix}`]: 'public.hap.characteristic.identify',
  [`00000019${UuidSuffix}`]: 'public.hap.characteristic.lock-management.control-point',
  [`0000001A${UuidSuffix}`]: 'public.hap.characteristic.lock-management.auto-secure-timeout',
  [`0000001C${UuidSuffix}`]: 'public.hap.characteristic.lock-mechanism.last-known-action',
  [`0000001D${UuidSuffix}`]: 'public.hap.characteristic.lock-mechanism.current-state',
  [`0000001E${UuidSuffix}`]: 'public.hap.characteristic.lock-mechanism.target-state',
  [`0000001F${UuidSuffix}`]: 'public.hap.characteristic.logs',
  [`00000020${UuidSuffix}`]: 'public.hap.characteristic.manufacturer',
  [`00000021${UuidSuffix}`]: 'public.hap.characteristic.model',
  [`00000022${UuidSuffix}`]: 'public.hap.characteristic.motion-detected',
  [`00000023${UuidSuffix}`]: 'public.hap.characteristic.name',
  [`00000024${UuidSuffix}`]: 'public.hap.characteristic.obstruction-detected',
  [`00000025${UuidSuffix}`]: 'public.hap.characteristic.on',
  [`00000026${UuidSuffix}`]: 'public.hap.characteristic.outlet-in-use',
  [`00000028${UuidSuffix}`]: 'public.hap.characteristic.rotation.direction',
  [`00000029${UuidSuffix}`]: 'public.hap.characteristic.rotation.speed',
  [`0000002F${UuidSuffix}`]: 'public.hap.characteristic.saturation',
  [`00000030${UuidSuffix}`]: 'public.hap.characteristic.serial-number',
  [`00000032${UuidSuffix}`]: 'public.hap.characteristic.door-state.target',
  [`00000033${UuidSuffix}`]: 'public.hap.characteristic.heating-cooling.target',
  [`00000034${UuidSuffix}`]: 'public.hap.characteristic.relative-humidity.target',
  [`00000035${UuidSuffix}`]: 'public.hap.characteristic.temperature.target',
  [`00000036${UuidSuffix}`]: 'public.hap.characteristic.temperature.units',
  [`00000037${UuidSuffix}`]: 'public.hap.characteristic.version',
  [`0000004C${UuidSuffix}`]: 'public.hap.characteristic.pairing.pair-setup',
  [`0000004E${UuidSuffix}`]: 'public.hap.characteristic.pairing.pair-verify',
  [`0000004F${UuidSuffix}`]: 'public.hap.characteristic.pairing.features',
  [`00000050${UuidSuffix}`]: 'public.hap.characteristic.pairing.pairings',
  [`00000052${UuidSuffix}`]: 'public.hap.characteristic.firmware.revision',
  [`00000053${UuidSuffix}`]: 'public.hap.characteristic.hardware.revision',
  [`00000054${UuidSuffix}`]: 'public.hap.characteristic.software.revision',
  [`00000057${UuidSuffix}`]: 'public.hap.characteristic.accessory-identifier',
  [`00000058${UuidSuffix}`]: 'public.hap.characteristic.tunneled-accessory-state-number',
  [`00000059${UuidSuffix}`]: 'public.hap.characteristic.tunneled-accessory-connected',
  [`0000005B${UuidSuffix}`]: 'public.hap.characteristic.relay-enabled',
  [`0000005C${UuidSuffix}`]: 'public.hap.characteristic.relay-state',
  [`0000005E${UuidSuffix}`]: 'public.hap.characteristic.relay-control-point',
  [`00000060${UuidSuffix}`]: 'public.hap.characteristic.tunneled-accessory-advertising',
  [`00000061${UuidSuffix}`]: 'public.hap.characteristic.tunnel-connection-timeout',
  [`00000063${UuidSuffix}`]: 'public.hap.characteristic.reachable',
  [`00000064${UuidSuffix}`]: 'public.hap.characteristic.air-particulate.density',
  [`00000065${UuidSuffix}`]: 'public.hap.characteristic.air-particulate.size',
  [`00000066${UuidSuffix}`]: 'public.hap.characteristic.security-system-state.current',
  [`00000067${UuidSuffix}`]: 'public.hap.characteristic.security-system-state.target',
  [`00000068${UuidSuffix}`]: 'public.hap.characteristic.battery-level',
  [`00000069${UuidSuffix}`]: 'public.hap.characteristic.carbon-monoxide.detected',
  [`0000006A${UuidSuffix}`]: 'public.hap.characteristic.contact-state',
  [`0000006B${UuidSuffix}`]: 'public.hap.characteristic.light-level.current',
  [`0000006C${UuidSuffix}`]: 'public.hap.characteristic.horizontal-tilt.current',
  [`0000006D${UuidSuffix}`]: 'public.hap.characteristic.position.current',
  [`0000006E${UuidSuffix}`]: 'public.hap.characteristic.vertical-tilt.current',
  [`0000006F${UuidSuffix}`]: 'public.hap.characteristic.position.hold',
  [`00000070${UuidSuffix}`]: 'public.hap.characteristic.leak-detected',
  [`00000071${UuidSuffix}`]: 'public.hap.characteristic.occupancy-detected',
  [`00000072${UuidSuffix}`]: 'public.hap.characteristic.position.state',
  [`00000073${UuidSuffix}`]: 'public.hap.characteristic.input-event',
  [`00000074${UuidSuffix}`]: 'public.hap.characteristic.programmable-switch-output-state',
  [`00000075${UuidSuffix}`]: 'public.hap.characteristic.status-active',
  [`00000076${UuidSuffix}`]: 'public.hap.characteristic.smoke-detected',
  [`00000077${UuidSuffix}`]: 'public.hap.characteristic.status-fault',
  [`00000078${UuidSuffix}`]: 'public.hap.characteristic.status-jammed',
  [`00000079${UuidSuffix}`]: 'public.hap.characteristic.status-lo-batt',
  [`0000007A${UuidSuffix}`]: 'public.hap.characteristic.status-tampered',
  [`0000007B${UuidSuffix}`]: 'public.hap.characteristic.horizontal-tilt.target',
  [`0000007C${UuidSuffix}`]: 'public.hap.characteristic.position.target',
  [`0000007D${UuidSuffix}`]: 'public.hap.characteristic.vertical-tilt.target',
  [`0000008E${UuidSuffix}`]: 'public.hap.characteristic.security-system.alarm-type',
  [`0000008F${UuidSuffix}`]: 'public.hap.characteristic.charging-state',
  [`00000090${UuidSuffix}`]: 'public.hap.characteristic.carbon-monoxide.level',
  [`00000091${UuidSuffix}`]: 'public.hap.characteristic.carbon-monoxide.peak-level',
  [`00000092${UuidSuffix}`]: 'public.hap.characteristic.carbon-dioxide.detected',
  [`00000093${UuidSuffix}`]: 'public.hap.characteristic.carbon-dioxide.level',
  [`00000094${UuidSuffix}`]: 'public.hap.characteristic.carbon-dioxide.peak-level',
  [`00000095${UuidSuffix}`]: 'public.hap.characteristic.air-quality',
  [`00000098${UuidSuffix}`]: 'public.hap.characteristic.day-of-the-week',
  [`0000009A${UuidSuffix}`]: 'public.hap.characteristic.time-update',
  [`0000009B${UuidSuffix}`]: 'public.hap.characteristic.current-time',
  [`0000009C${UuidSuffix}`]: 'public.hap.characteristic.link-quality',
  [`0000009D${UuidSuffix}`]: 'public.hap.characteristic.configure-bridged-accessory-status',
  [`0000009E${UuidSuffix}`]: 'public.hap.characteristic.discover-bridged-accessories',
  [`0000009F${UuidSuffix}`]: 'public.hap.characteristic.discovered-bridged-accessories',
  [`000000A0${UuidSuffix}`]: 'public.hap.characteristic.configure-bridged-accessory',
  [`000000A3${UuidSuffix}`]: 'public.hap.characteristic.category',
  [`000000A4${UuidSuffix}`]: 'public.hap.characteristic.app-matching-identifier',
  [`000000A6${UuidSuffix}`]: 'public.hap.characteristic.accessory-properties',
  [`000000A7${UuidSuffix}`]: 'public.hap.characteristic.lock-physical-controls',
  [`000000A8${UuidSuffix}`]: 'public.hap.characteristic.air-purifier.state.target',
  [`000000A9${UuidSuffix}`]: 'public.hap.characteristic.air-purifier.state.current',
  [`000000AA${UuidSuffix}`]: 'public.hap.characteristic.slat.state.current',
  [`000000AB${UuidSuffix}`]: 'public.hap.characteristic.filter.life-level',
  [`000000AC${UuidSuffix}`]: 'public.hap.characteristic.filter.change-indication',
  [`000000AD${UuidSuffix}`]: 'public.hap.characteristic.filter.reset-indication',
  [`000000AF${UuidSuffix}`]: 'public.hap.characteristic.fan.state.current',
  [`000000B0${UuidSuffix}`]: 'public.hap.characteristic.active',
  [`000000B1${UuidSuffix}`]: 'public.hap.characteristic.heater-cooler.state.current',
  [`000000B2${UuidSuffix}`]: 'public.hap.characteristic.heater-cooler.state.target',
  [`000000B3${UuidSuffix}`]: 'public.hap.characteristic.humidifier-dehumidifier.state.current',
  [`000000B4${UuidSuffix}`]: 'public.hap.characteristic.humidifier-dehumidifier.state.target',
  [`000000B5${UuidSuffix}`]: 'public.hap.characteristic.water-level',
  [`000000B6${UuidSuffix}`]: 'public.hap.characteristic.swing-mode',
  [`000000BF${UuidSuffix}`]: 'public.hap.characteristic.fan.state.target',
  [`000000C0${UuidSuffix}`]: 'public.hap.characteristic.type.slat',
  [`000000C1${UuidSuffix}`]: 'public.hap.characteristic.tilt.current',
  [`000000C2${UuidSuffix}`]: 'public.hap.characteristic.tilt.target',
  [`000000C3${UuidSuffix}`]: 'public.hap.characteristic.density.ozone',
  [`000000C4${UuidSuffix}`]: 'public.hap.characteristic.density.no2',
  [`000000C5${UuidSuffix}`]: 'public.hap.characteristic.density.so2',
  [`000000C6${UuidSuffix}`]: 'public.hap.characteristic.density.pm25',
  [`000000C7${UuidSuffix}`]: 'public.hap.characteristic.density.pm10',
  [`000000C8${UuidSuffix}`]: 'public.hap.characteristic.density.voc',
  [`000000C9${UuidSuffix}`]: 'public.hap.characteristic.relative-humidity.dehumidifier-threshold',
  [`000000CA${UuidSuffix}`]: 'public.hap.characteristic.relative-humidity.humidifier-threshold',
  [`000000CB${UuidSuffix}`]: 'public.hap.characteristic.service-label-index',
  [`000000CD${UuidSuffix}`]: 'public.hap.characteristic.service-label-namespace',
  [`000000CE${UuidSuffix}`]: 'public.hap.characteristic.color-temperature',
  [`000000D1${UuidSuffix}`]: 'public.hap.characteristic.program-mode',
  [`000000D2${UuidSuffix}`]: 'public.hap.characteristic.in-use',
  [`000000D3${UuidSuffix}`]: 'public.hap.characteristic.set-duration',
  [`000000D4${UuidSuffix}`]: 'public.hap.characteristic.remaining-duration',
  [`000000D5${UuidSuffix}`]: 'public.hap.characteristic.valve-type',
  [`000000D6${UuidSuffix}`]: 'public.hap.characteristic.is-configured',
  [`000000DB${UuidSuffix}`]: 'public.hap.characteristic.input-source-type',
  [`000000DC${UuidSuffix}`]: 'public.hap.characteristic.input-device-type',
  [`000000DD${UuidSuffix}`]: 'public.hap.characteristic.closed-captions',
  [`000000DF${UuidSuffix}`]: 'public.hap.characteristic.power-mode-selection',
  [`000000E0${UuidSuffix}`]: 'public.hap.characteristic.current-media-state',
  [`000000E1${UuidSuffix}`]: 'public.hap.characteristic.remote-key',
  [`000000E2${UuidSuffix}`]: 'public.hap.characteristic.picture-mode',
  [`000000E3${UuidSuffix}`]: 'public.hap.characteristic.configured-name',
  [`000000E6${UuidSuffix}`]: 'public.hap.characteristic.identifier',
  [`000000E7${UuidSuffix}`]: 'public.hap.characteristic.active-identifier',
  [`000000E8${UuidSuffix}`]: 'public.hap.characteristic.sleep-discovery-mode',
  [`000000E9${UuidSuffix}`]: 'public.hap.characteristic.volume-control-type',
  [`000000EA${UuidSuffix}`]: 'public.hap.characteristic.volume-selector',
  [`00000114${UuidSuffix}`]: 'public.hap.characteristic.supported-video-stream-configuration',
  [`00000115${UuidSuffix}`]: 'public.hap.characteristic.supported-audio-configuration',
  [`00000116${UuidSuffix}`]: 'public.hap.characteristic.supported-rtp-configuration',
  [`00000117${UuidSuffix}`]: 'public.hap.characteristic.selected-rtp-stream-configuration',
  [`00000118${UuidSuffix}`]: 'public.hap.characteristic.setup-endpoints',
  [`00000119${UuidSuffix}`]: 'public.hap.characteristic.volume',
  [`0000011A${UuidSuffix}`]: 'public.hap.characteristic.mute',
  [`0000011B${UuidSuffix}`]: 'public.hap.characteristic.night-vision',
  [`0000011C${UuidSuffix}`]: 'public.hap.characteristic.zoom-optical',
  [`0000011D${UuidSuffix}`]: 'public.hap.characteristic.zoom-digital',
  [`0000011E${UuidSuffix}`]: 'public.hap.characteristic.image-rotation',
  [`0000011F${UuidSuffix}`]: 'public.hap.characteristic.image-mirror',
  [`00000120${UuidSuffix}`]: 'public.hap.characteristic.streaming-status',
  [`00000123${UuidSuffix}`]: 'public.hap.characteristic.supported-target-configuration',
  [`00000124${UuidSuffix}`]: 'public.hap.characteristic.target-list',
  [`00000126${UuidSuffix}`]: 'public.hap.characteristic.button-event',
  [`00000128${UuidSuffix}`]: 'public.hap.characteristic.selected-audio-stream-configuration',
  [`00000130${UuidSuffix}`]: 'public.hap.characteristic.supported-data-stream-transport-configuration',
  [`00000131${UuidSuffix}`]: 'public.hap.characteristic.setup-data-stream-transport',
  [`00000132${UuidSuffix}`]: 'public.hap.characteristic.siri-input-type',
  [`00000134${UuidSuffix}`]: 'public.hap.characteristic.target-visibility-state',
  [`00000135${UuidSuffix}`]: 'public.hap.characteristic.current-visibility-state',
  [`00000136${UuidSuffix}`]: 'public.hap.characteristic.display-order',
  [`00000137${UuidSuffix}`]: 'public.hap.characteristic.target-media-state',
};

const CharacteristicMapByCharacteristic = Object.assign(
  {},
  ...Object.entries(CharacteristicMapByUuid).map(([a, b]) => ({[b]: a}))
);

/**
 * Get a characteristic name from its UUID.
 *
 * @param {string} uuid - Characteristic UUID
 * @returns {string} Characteristic name
 */
function characteristicFromUuid(uuid) {
  if (uuid.length <= 8) {
    uuid = `${uuid.padStart(8, '0')}${UuidSuffix}`;
  }

  uuid = uuid.toUpperCase();

  return CharacteristicMapByUuid[uuid] || uuid;
}

/**
 * Get a characteristic UUID from its name.
 *
 * @param {string} characteristic - Characteristic name
 * @returns {string} Characteristic UUID
 */
function uuidFromCharacteristic(characteristic) {
  return CharacteristicMapByCharacteristic[characteristic] || characteristic;
}

module.exports = {
  characteristicFromUuid,
  uuidFromCharacteristic,
};
