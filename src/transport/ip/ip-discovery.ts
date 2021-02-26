/**
 * Zeroconf wrappers for finding HAP devices.
 */

import { EventEmitter } from 'events';
import { Browser, Options, Service, ServiceType } from 'dnssd';

export interface HapService {
  name: string;
  address: string;
  port: number;
  'c#': number;
  ff: number;
  id: string;
  md: string;
  pv: string;
  's#': number;
  sf: number;
  ci: number;
}

export default class IPDiscovery extends EventEmitter {
  private browser: Browser | null;

  private iface?: string;

  private services: Map<string, HapService>;

  /**
   * Initialize the IPDiscovery object.
   *
   * @param {string?} iface - Optional interface to bind to
   */
  constructor(iface?: string) {
    super();
    this.browser = null;

    if (iface) {
      this.iface = iface;
    }

    this.services = new Map();
  }

  /**
   * Convert a DNS-SD service record to a HAP service object.
   *
   * See Table 5-7
   *
   * @param {Object} service - Service record to convert
   */
  private static _serviceToHapService(service: Service): HapService {
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
  start(): void {
    if (this.browser) {
      this.browser.stop();
    }

    const options: Options = {};
    if (this.iface) {
      options.interface = this.iface;
    }

    this.browser = new Browser(new ServiceType('_hap._tcp'), options);
    this.browser.on('serviceUp', (service) => {
      const hapService = IPDiscovery._serviceToHapService(service);
      this.services.set(hapService.id, hapService);
      this.emit('serviceUp', hapService);
    });
    this.browser.on('serviceDown', (service) => {
      const hapService = IPDiscovery._serviceToHapService(service);
      this.services.delete(hapService.id);
      this.emit('serviceDown', hapService);
    });
    this.browser.start();
  }

  /**
   * List the currently known services.
   *
   * @returns {Object[]} Array of services
   */
  list(): HapService[] {
    return Array.from(this.services.values());
  }

  /**
   * Stop an ongoing discovery process.
   */
  stop(): void {
    if (this.browser) {
      this.browser.stop();
      this.browser = null;
    }
  }
}
