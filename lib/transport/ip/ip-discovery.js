/**
 * Zeroconf wrappers for finding HAP devices.
 */
'use strict';

const EventEmitter = require('events');
const dnssd = require('dnssd');

class IPDiscovery extends EventEmitter {
  /**
   * Initialize the IPDiscovery object.
   */
  constructor() {
    super();
    this.browser = null;
  }

  /**
   * Convert a DNS-SD service record to a HAP service object.
   *
   * See Table 5-7
   *
   * @param {Object} service - Service record to convert
   */
  static _serviceToHapService(service) {
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
   */
  start() {
    if (this.browser) {
      this.browser.stop();
    }

    this.browser = new dnssd.Browser(new dnssd.ServiceType('_hap._tcp'));
    this.browser.on('serviceUp', (service) => {
      this.emit('serviceUp', IPDiscovery._serviceToHapService(service));
    });
    this.browser.on('serviceDown', (service) => {
      this.emit('serviceDown', IPDiscovery._serviceToHapService(service));
    });
    this.browser.start();
  }

  /**
   * Stop an ongoing discovery process.
   */
  stop() {
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
  }
}

module.exports = IPDiscovery;
