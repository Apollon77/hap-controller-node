/**
 * Service types.
 *
 * See Chapter 9.
 */
/* eslint-disable max-len */
'use strict';

const ServiceMapByUuid = {
  '0000003E-0000-1000-8000-0026BB765291': 'public.hap.service.accessory-information',
  '00000040-0000-1000-8000-0026BB765291': 'public.hap.service.fan',
  '00000041-0000-1000-8000-0026BB765291': 'public.hap.service.garage-door-opener',
  '00000043-0000-1000-8000-0026BB765291': 'public.hap.service.lightbulb',
  '00000044-0000-1000-8000-0026BB765291': 'public.hap.service.lock-management',
  '00000045-0000-1000-8000-0026BB765291': 'public.hap.service.lock-mechanism',
  '00000047-0000-1000-8000-0026BB765291': 'public.hap.service.outlet',
  '00000049-0000-1000-8000-0026BB765291': 'public.hap.service.switch',
  '0000004A-0000-1000-8000-0026BB765291': 'public.hap.service.thermostat',
  '0000007E-0000-1000-8000-0026BB765291': 'public.hap.service.security-system',
  '0000007F-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.carbon-monoxide',
  '00000080-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.contact',
  '00000081-0000-1000-8000-0026BB765291': 'public.hap.service.door',
  '00000082-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.humidity',
  '00000083-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.leak',
  '00000084-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.light',
  '00000085-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.motion',
  '00000086-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.occupancy',
  '00000087-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.smoke',
  '00000089-0000-1000-8000-0026BB765291': 'public.hap.service.stateless-programmable-switch',
  '0000008A-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.temperature',
  '0000008B-0000-1000-8000-0026BB765291': 'public.hap.service.window',
  '0000008C-0000-1000-8000-0026BB765291': 'public.hap.service.window-covering',
  '0000008D-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.air-quality',
  '00000096-0000-1000-8000-0026BB765291': 'public.hap.service.battery',
  '00000097-0000-1000-8000-0026BB765291': 'public.hap.service.sensor.carbon-dioxide',
  '000000B7-0000-1000-8000-0026BB765291': 'public.hap.service.fanv2',
  '000000B9-0000-1000-8000-0026BB765291': 'public.hap.service.vertical-slat',
  '000000BA-0000-1000-8000-0026BB765291': 'public.hap.service.filter-maintenance',
  '000000BB-0000-1000-8000-0026BB765291': 'public.hap.service.air-purifier',
  '000000CC-0000-1000-8000-0026BB765291': 'public.hap.service.service-label',
  '00000110-0000-1000-8000-0026BB765291': 'public.hap.service.camera-rtp-stream-management',
  '00000112-0000-1000-8000-0026BB765291': 'public.hap.service.microphone',
  '00000113-0000-1000-8000-0026BB765291': 'public.hap.service.speaker',
  '00000121-0000-1000-8000-0026BB765291': 'public.hap.service.doorbell',
};

const ServiceMapByService = Object.assign(
  {},
  ...Object.entries(ServiceMapByUuid).map(([a, b]) => ({[b]: a}))
);

/**
 * Get a service name from its UUID.
 *
 * @param {string} uuid - Service UUID
 * @returns {string} Service name
 */
function serviceFromUuid(uuid) {
  return ServiceMapByUuid[uuid] || uuid;
}

/**
 * Get a service UUID from its name.
 *
 * @param {string} service - Service name
 * @returns {string} Service UUID
 */
function uuidFromService(service) {
  return ServiceMapByService || service;
}

module.exports = {
  serviceFromUuid,
  uuidFromService,
};
