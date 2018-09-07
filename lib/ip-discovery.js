/**
 * Zeroconf wrappers for finding HAP devices.
 */
'use strict';

const dnssd = require('dnssd');

let browser = null;

/**
 * Convert a DNS-SD service record to a HAP service object.
 *
 * See Table 5-7
 *
 * @param {Object} service - Service record to convert
 */
function serviceToHapService(service) {
  return {
    name: service.name,
    address: service.addresses[0],
    port: service.port,
    'c#': parseInt(service.txt['c#']),
    ff: parseInt(service.txt.ff || '0', 10),
    id: service.txt.id,
    md: service.txt.md,
    pv: service.txt.pv || '1.0',
    's#': parseInt(service.txt['s#'], 10),
    sf: parseInt(service.txt.sf, 10),
    ci: parseInt(service.txt.ci, 10),
  };
}

/**
 * Start searching for HAP devices on the network.
 *
 * The serviceUpCallback is called when a new HAP device is found, and is
 * passed an object containing the HAP advertisement parameters.
 *
 * The serviceDownCallback is called when a HAP device disappears from the
 * network, and is passed an object containing the HAP advertisement parameters.
 *
 * @param {callback} serviceUpCallback - Called when a new HAP device is found
 * @param {callback} serviceDownCallback - Called when a HAP device disappears
 */
function startDiscovery(serviceUpCallback, serviceDownCallback) {
  if (browser) {
    browser.stop();
  }

  browser = new dnssd.Browser(new dnssd.ServiceType('_hap._tcp'));
  browser.on('serviceUp', (service) => {
    if (serviceUpCallback) {
      serviceUpCallback(serviceToHapService(service));
    }
  });
  browser.on('serviceDown', (service) => {
    if (serviceDownCallback) {
      serviceDownCallback(serviceToHapService(service));
    }
  });
  browser.start();
}

/**
 * Stop an ongoing discovery process.
 */
function stopDiscovery() {
  if (browser) {
    browser.stop();
    browser = null;
  }
}

module.exports = {
  startDiscovery,
  stopDiscovery,
};
