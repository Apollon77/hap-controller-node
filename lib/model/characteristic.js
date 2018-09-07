/**
 * Accessory characteristic types.
 *
 * See Chapter 8
 */
/* eslint-disable max-len */
'use strict';

const CharacteristicMapByUuid = {
  '00000001-0000-1000-8000-0026BB765291': 'public.hap.characteristic.administrator-only-access',
  '00000005-0000-1000-8000-0026BB765291': 'public.hap.characteristic.audio-feedback',
  '00000008-0000-1000-8000-0026BB765291': 'public.hap.characteristic.brightness',
  '0000000D-0000-1000-8000-0026BB765291': 'public.hap.characteristic.temperature.cooling-threshold',
  '0000000E-0000-1000-8000-0026BB765291': 'public.hap.characteristic.door-state.current',
  '0000000F-0000-1000-8000-0026BB765291': 'public.hap.characteristic.heating-cooling.current',
  '00000010-0000-1000-8000-0026BB765291': 'public.hap.characteristic.relative-humidity.current',
  '00000011-0000-1000-8000-0026BB765291': 'public.hap.characteristic.temperature.current',
  '00000012-0000-1000-8000-0026BB765291': 'public.hap.characteristic.temperature.heating-threshold',
  '00000013-0000-1000-8000-0026BB765291': 'public.hap.characteristic.hue',
  '00000014-0000-1000-8000-0026BB765291': 'public.hap.characteristic.identify',
  '0000001A-0000-1000-8000-0026BB765291': 'public.hap.characteristic.lock-management.auto-secure-timeout',
  '0000001C-0000-1000-8000-0026BB765291': 'public.hap.characteristic.lock-mechanism.last-known-action',
  '0000001D-0000-1000-8000-0026BB765291': 'public.hap.characteristic.lock-mechanism.current-state',
  '0000001E-0000-1000-8000-0026BB765291': 'public.hap.characteristic.lock-mechanism.target-state',
  '0000001F-0000-1000-8000-0026BB765291': 'public.hap.characteristic.logs',
  '00000019-0000-1000-8000-0026BB765291': 'public.hap.characteristic.lock-management.control-point',
  '00000020-0000-1000-8000-0026BB765291': 'public.hap.characteristic.manufacturer',
  '00000021-0000-1000-8000-0026BB765291': 'public.hap.characteristic.model',
  '00000022-0000-1000-8000-0026BB765291': 'public.hap.characteristic.motion-detected',
  '00000023-0000-1000-8000-0026BB765291': 'public.hap.characteristic.name',
  '00000024-0000-1000-8000-0026BB765291': 'public.hap.characteristic.obstruction-detected',
  '00000025-0000-1000-8000-0026BB765291': 'public.hap.characteristic.on',
  '00000026-0000-1000-8000-0026BB765291': 'public.hap.characteristic.outlet-in-use',
  '00000028-0000-1000-8000-0026BB765291': 'public.hap.characteristic.rotation.direction',
  '00000029-0000-1000-8000-0026BB765291': 'public.hap.characteristic.rotation.speed',
  '0000002F-0000-1000-8000-0026BB765291': 'public.hap.characteristic.saturation',
  '00000030-0000-1000-8000-0026BB765291': 'public.hap.characteristic.serial-number',
  '00000032-0000-1000-8000-0026BB765291': 'public.hap.characteristic.door-state.target',
  '00000033-0000-1000-8000-0026BB765291': 'public.hap.characteristic.heating-cooling.target',
  '00000034-0000-1000-8000-0026BB765291': 'public.hap.characteristic.relative-humidity.target',
  '00000035-0000-1000-8000-0026BB765291': 'public.hap.characteristic.temperature.target',
  '00000036-0000-1000-8000-0026BB765291': 'public.hap.characteristic.temperature.units',
  '00000037-0000-1000-8000-0026BB765291': 'public.hap.characteristic.version',
  '00000052-0000-1000-8000-0026BB765291': 'public.hap.characteristic.firmware.revision',
  '00000053-0000-1000-8000-0026BB765291': 'public.hap.characteristic.hardware.revision',
  '00000064-0000-1000-8000-0026BB765291': 'public.hap.characteristic.air-particulate.density',
  '00000065-0000-1000-8000-0026BB765291': 'public.hap.characteristic.air-particulate.size',
  '00000066-0000-1000-8000-0026BB765291': 'public.hap.characteristic.security-system-state.current',
  '00000067-0000-1000-8000-0026BB765291': 'public.hap.characteristic.security-system-state.target',
  '00000068-0000-1000-8000-0026BB765291': 'public.hap.characteristic.battery-level',
  '00000069-0000-1000-8000-0026BB765291': 'public.hap.characteristic.carbon-monoxide.detected',
  '0000006A-0000-1000-8000-0026BB765291': 'public.hap.characteristic.contact-state',
  '0000006B-0000-1000-8000-0026BB765291': 'public.hap.characteristic.light-level.current',
  '0000006C-0000-1000-8000-0026BB765291': 'public.hap.characteristic.horizontal-tilt.current',
  '0000006D-0000-1000-8000-0026BB765291': 'public.hap.characteristic.position.current',
  '0000006E-0000-1000-8000-0026BB765291': 'public.hap.characteristic.vertical-tilt.current',
  '0000006F-0000-1000-8000-0026BB765291': 'public.hap.characteristic.position.hold',
  '00000070-0000-1000-8000-0026BB765291': 'public.hap.characteristic.leak-detected',
  '00000071-0000-1000-8000-0026BB765291': 'public.hap.characteristic.occupancy-detected',
  '00000072-0000-1000-8000-0026BB765291': 'public.hap.characteristic.position.state',
  '00000073-0000-1000-8000-0026BB765291': 'public.hap.characteristic.input-event',
  '00000075-0000-1000-8000-0026BB765291': 'public.hap.characteristic.status-active',
  '00000076-0000-1000-8000-0026BB765291': 'public.hap.characteristic.smoke-detected',
  '00000077-0000-1000-8000-0026BB765291': 'public.hap.characteristic.status-fault',
  '00000078-0000-1000-8000-0026BB765291': 'public.hap.characteristic.status-jammed',
  '00000079-0000-1000-8000-0026BB765291': 'public.hap.characteristic.status-lo-batt',
  '0000007A-0000-1000-8000-0026BB765291': 'public.hap.characteristic.status-tampered',
  '0000007B-0000-1000-8000-0026BB765291': 'public.hap.characteristic.horizontal-tilt.target',
  '0000007C-0000-1000-8000-0026BB765291': 'public.hap.characteristic.position.target',
  '0000007D-0000-1000-8000-0026BB765291': 'public.hap.characteristic.vertical-tilt.target',
  '0000008E-0000-1000-8000-0026BB765291': 'public.hap.characteristic.security-system.alarm-type',
  '0000008F-0000-1000-8000-0026BB765291': 'public.hap.characteristic.charging-state',
  '00000090-0000-1000-8000-0026BB765291': 'public.hap.characteristic.carbon-monoxide.level',
  '00000091-0000-1000-8000-0026BB765291': 'public.hap.characteristic.carbon-monoxide.peak-level',
  '00000092-0000-1000-8000-0026BB765291': 'public.hap.characteristic.carbon-dioxide.detected',
  '00000093-0000-1000-8000-0026BB765291': 'public.hap.characteristic.carbon-dioxide.level',
  '00000094-0000-1000-8000-0026BB765291': 'public.hap.characteristic.carbon-dioxide.peak-level',
  '00000095-0000-1000-8000-0026BB765291': 'public.hap.characteristic.air-quality',
  '000000A6-0000-1000-8000-0026BB765291': 'public.hap.characteristic.accessory-properties',
  '000000A7-0000-1000-8000-0026BB765291': 'public.hap.characteristic.lock-physical-controls',
  '000000A8-0000-1000-8000-0026BB765291': 'public.hap.characteristic.air-purifier.state.target',
  '000000A9-0000-1000-8000-0026BB765291': 'public.hap.characteristic.air-purifier.state.current',
  '000000AA-0000-1000-8000-0026BB765291': 'public.hap.characteristic.slat.state.current',
  '000000AB-0000-1000-8000-0026BB765291': 'public.hap.characteristic.filter.life-level',
  '000000AC-0000-1000-8000-0026BB765291': 'public.hap.characteristic.filter.change-indication',
  '000000AD-0000-1000-8000-0026BB765291': 'public.hap.characteristic.filter.reset-indication',
  '000000AF-0000-1000-8000-0026BB765291': 'public.hap.characteristic.fan.state.current',
  '000000B0-0000-1000-8000-0026BB765291': 'public.hap.characteristic.active',
  '000000B6-0000-1000-8000-0026BB765291': 'public.hap.characteristic.swing-mode',
  '000000BF-0000-1000-8000-0026BB765291': 'public.hap.characteristic.fan.state.target',
  '000000C0-0000-1000-8000-0026BB765291': 'public.hap.characteristic.type.slat',
  '000000C1-0000-1000-8000-0026BB765291': 'public.hap.characteristic.tilt.current',
  '000000C2-0000-1000-8000-0026BB765291': 'public.hap.characteristic.tilt.target',
  '000000C3-0000-1000-8000-0026BB765291': 'public.hap.characteristic.density.ozone',
  '000000C4-0000-1000-8000-0026BB765291': 'public.hap.characteristic.density.no2',
  '000000C5-0000-1000-8000-0026BB765291': 'public.hap.characteristic.density.so2',
  '000000C6-0000-1000-8000-0026BB765291': 'public.hap.characteristic.density.pm25',
  '000000C7-0000-1000-8000-0026BB765291': 'public.hap.characteristic.density.pm10',
  '000000C8-0000-1000-8000-0026BB765291': 'public.hap.characteristic.density.voc',
  '000000CB-0000-1000-8000-0026BB765291': 'public.hap.characteristic.service-label-index',
  '000000CD-0000-1000-8000-0026BB765291': 'public.hap.characteristic.service-label-namespace',
  '000000CE-0000-1000-8000-0026BB765291': 'public.hap.characteristic.color-temperature',
  '00000114-0000-1000-8000-0026BB765291': 'public.hap.characteristic.supported-video-stream-configuration',
  '00000115-0000-1000-8000-0026BB765291': 'public.hap.characteristic.supported-audio-configuration',
  '00000116-0000-1000-8000-0026BB765291': 'public.hap.characteristic.supported-rtp-configuration',
  '00000117-0000-1000-8000-0026BB765291': 'public.hap.characteristic.selected-rtp-stream-configuration',
  '00000118-0000-1000-8000-0026BB765291': 'public.hap.characteristic.setup-endpoints',
  '00000119-0000-1000-8000-0026BB765291': 'public.hap.characteristic.volume',
  '0000011A-0000-1000-8000-0026BB765291': 'public.hap.characteristic.mute',
  '0000011B-0000-1000-8000-0026BB765291': 'public.hap.characteristic.night-vision',
  '0000011C-0000-1000-8000-0026BB765291': 'public.hap.characteristic.zoom-optical',
  '0000011D-0000-1000-8000-0026BB765291': 'public.hap.characteristic.zoom-digital',
  '0000011E-0000-1000-8000-0026BB765291': 'public.hap.characteristic.image-rotation',
  '0000011F-0000-1000-8000-0026BB765291': 'public.hap.characteristic.image-mirror',
  '00000120-0000-1000-8000-0026BB765291': 'public.hap.characteristic.streaming-status',
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
