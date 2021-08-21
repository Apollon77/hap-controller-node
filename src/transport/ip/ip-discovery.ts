/**
 * Zeroconf wrappers for finding HAP devices.
 */

import { EventEmitter } from 'events';
import { Browser, Options, Service, ServiceType } from 'dnssd';
import { PairMethods } from '../../protocol/pairing-protocol';

/**
 * Service data structure returned by discovery methods
 */
export interface HapService {
  /**
   * name: the Bonjour name of the HomeKit accessory (i.e. Testsensor1._hap._tcp.local.)
   */
  name: string;
  /**
   * address: the IP address of the accessory
   */
  address: string;
  /**
   * port: the used port
   */
  port: number;
  /**
   * c#: the configuration number (required),
   * monitor that value and refresh device definition if it increases
   *
   * From Specs:
   * Must update when an accessory, service, or characteristic is added or removed
   * on the accessory server. Accessories must increment the config number after a firmware update.
   * This must have a range of 1-65535 and wrap to 1 when it overflows.
   * This value must persist across reboots, power cycles, etc.
   */
  'c#': number;
  /**
   * ff / flags: the numerical and human readable version of the feature flags
   *
   * From Specs:
   * Pairing Feature flags (e.g. ”0x3” for bits 0 and 1). Required if non-zero.
   * See Table 5-4 (page 49).
   * See PairingFeatureFlags
   */
  ff: number;
  /**
   * id: Device ID (”5.4 Device ID” (page 31)) of the accessory.
   *
   * From Specs:
   * The Device ID must be formatted as ”XX:XX:XX:XX:XX:XX”, where ”XX” is a hexadecimal string
   * representing a byte. Required.
   * This value is also used as the accessoryʼs Pairing Identifier.
   */
  id: string;
  /**
   * md: the Model name of the accessory (e.g. ”Device1,1”). Required.
   */
  md: string;
  /**
   * pv: the protocol version
   *
   * From Specs:
   * Protocol version string ”X.Y” (e.g. ”1.0”). Required if value is not ”1.0”.
   * (see ”6.6.3 IP Protocol Version” (page 61))
   * It must be set to ”1.1” for this version of HAP IP.
   */
  pv: string;
  /**
   * s#: Current state number. Required.
   *
   * From Specs:
   * This must have a value of ”1”.
   */
  's#': number;
  /**
   * sf / statusflags: Status flags. Required
   *
   * From Specs:
   * (e.g. ”0x04” for bit 3). Value should be an unsigned integer.
   * See Table 6-8 (page 58)
   * See DiscoveryStatusFlags
   */
  sf: number;
  /**
   * ci / category: the category identifier in numerical and human readable form. Required.
   *
   * From Specs:
   * Indicates the category that best describes the primary function of the accessory.
   * This must have a range of 1-65535. This must take values defined in
   * ”13-1 Accessory Categories” (page 252).
   * This must persist across reboots, power cycles, etc.
   */
  ci: number;
  /**
   * Added in v2 of the HAP specifications but no details known
   * sh: Setup Hash.
   *
   * From Specs:
   * See (”?? ??” (page ??)) Required if the accessory supports enhanced setup payload information.
   */
  // sh: string;
  /**
   * availableToPair: is the device available for pairing?
   */
  availableToPair: boolean;
}

/**
 * See Table 6-8
 */
const DiscoveryPairingStatusFlags = {
  AccessoryNotPaired: 0x01,
  AccessoryNotConfiguredToJoinWifi: 0x02,
  AccessoryHasProblems: 0x04,
};

/**
 * See Table 5-4
 */
const DiscoveryPairingFeatureFlags = {
  SupportsAppleAuthenticationCoprocessor: 0x01,
  SupportsSoftwareAuthentication: 0x02,
};

export { DiscoveryPairingStatusFlags, DiscoveryPairingFeatureFlags };

/**
 * Handle discovery of IP devices
 *
 * @fires IPDiscovery#serviceUp
 * @fires IPDiscovery#serviceDown
 * @fires IPDiscovery#serviceChanged
 */
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
    const sf = parseInt(service.txt.sf, 10);
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
      sf,
      ci: parseInt(service.txt.ci, 10),
      // sh: service.txt.sh,
      availableToPair: !!(sf & DiscoveryPairingStatusFlags.AccessoryNotPaired),
    };
  }

  /**
   * Get PairMethod to use for pairing from the data received during discovery
   *
   * @param {HapService} service Discovered service object to check
   * @returns {Promise<number>} Promise which resolves with the PairMethod to use
   */
  public static async getPairMethod(service: HapService): Promise<number> {
    // async to be compatible with the BLE variant
    return service.ff & DiscoveryPairingFeatureFlags.SupportsAppleAuthenticationCoprocessor
      ? PairMethods.PairSetupWithAuth
      : PairMethods.PairSetup;
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
      /**
       * New device discovered event
       *
       * @event IPDiscovery#serviceUp
       * @type HapService
       */
      this.emit('serviceUp', hapService);
    });
    this.browser.on('serviceDown', (service) => {
      const hapService = IPDiscovery._serviceToHapService(service);
      this.services.delete(hapService.id);
      /**
       * Device offline event
       *
       * @event IPDiscovery#serviceDown
       * @type HapService
       */
      this.emit('serviceDown', hapService);
    });
    this.browser.on('serviceChanged', (service) => {
      const hapService = IPDiscovery._serviceToHapService(service);
      this.services.set(hapService.id, hapService);
      /**
       * Device data changed event
       *
       * @event IPDiscovery#serviceChanged
       * @type HapService
       */
      this.emit('serviceChanged', hapService);
    });
    this.browser.start();
  }

  /**
   * List the currently known services.
   *
   * @returns {HapService[]} Array of services
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
