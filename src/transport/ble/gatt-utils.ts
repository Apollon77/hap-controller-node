import { Peripheral } from '@abandonware/noble';

/**
 * Convert a proper UUID to noble's format.
 *
 * @param {string} uuid - UUID to convert
 * @returns {string} UUID
 */
export function uuidToNobleUuid(uuid: string): string {
  return uuid.toLowerCase().replace(/-/g, '');
}

/**
 * Convert a UUID in noble's format to a proper UUID.
 *
 * @param {string} uuid - UUID to convert
 * @returns {string} UUID
 */
export function nobleUuidToUuid(uuid: string): string {
  uuid = uuid.toUpperCase();

  if (uuid.length !== 32) {
    return uuid;
  }

  const parts = [
    uuid.substring(0, 8),
    uuid.substring(8, 12),
    uuid.substring(12, 16),
    uuid.substring(16, 20),
    uuid.substring(20, 32),
  ];

  return parts.join('-');
}

/**
 * Unpack a HAP value from a buffer.
 *
 * @param {Buffer} buffer - Buffer to unpack
 * @param {string} format - HAP data format
 * @returns {*} Unpacked value.
 */
export function bufferToValue(buffer: Buffer, format: string): unknown {
  switch (format) {
    case 'bool':
      return buffer.readUInt8(0) !== 0;
    case 'uint8':
      return buffer.readUInt8(0);
    case 'uint16':
      return buffer.readUInt16LE(0);
    case 'uint32':
      return buffer.readUInt32LE(0);
    case 'uint64':
      return buffer.readUInt32LE(0) || buffer.readUInt32LE(4) << 32;
    case 'int':
      return buffer.readInt32LE(0);
    case 'float':
      return buffer.readFloatLE(0);
    case 'string':
      return buffer.toString();
    case 'data':
      return buffer.toString('base64');
    default:
      throw new Error(`Unknown format type: ${format}`);
  }
}

/**
 * Pack a HAP value into a buffer.
 *
 * @param {*} value - Value to pack
 * @param {string} format - HAP data format
 * @returns {Buffer} Packed buffer
 */
export function valueToBuffer(value: unknown, format: string): Buffer {
  switch (format) {
    case 'bool':
      return Buffer.from([<boolean>value ? 1 : 0]);
    case 'uint8':
      return Buffer.from([(<number>value) & 0xff]);
    case 'uint16': {
      const b = Buffer.alloc(2);
      b.writeUInt16LE(<number>value, 0);
      return b;
    }
    case 'uint32': {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(<number>value, 0);
      return b;
    }
    case 'uint64': {
      const b = Buffer.alloc(8);
      b.writeUInt32LE((<number>value) & 0xffffffff, 0);
      b.writeUInt32LE((<number>value) >> 32, 4);
      return b;
    }
    case 'int': {
      const b = Buffer.alloc(4);
      b.writeInt32LE(<number>value);
      return b;
    }
    case 'float': {
      const b = Buffer.alloc(4);
      b.writeFloatLE(<number>value);
      return b;
    }
    case 'string':
      return Buffer.from(<string>value);
    case 'data':
      if (typeof value === 'string') {
        return Buffer.from(value, 'base64');
      }

      return <Buffer>value;
    default:
      throw new Error(`Unknown format type: ${format}`);
  }
}

/**
 * This should be used when doing any communication with a BLE device, since
 * noble doesn't provide any timeout functionality.
 */
export class Watcher<T> {
  rejected: boolean;

  stopped: boolean;

  private peripheral: Peripheral;

  private rejectFn?: (reason: string) => void;

  private reject: (reason?: string) => void;

  private timer?: NodeJS.Timeout;

  private promise: Promise<T>;

  /**
   * Initialize the Watcher object.
   *
   * @param {Object} peripheral - The noble peripheral object
   * @param {Promise} watch - The Promise to set a timeout on
   * @param {number?} timeout - Timeout
   */
  constructor(peripheral: Peripheral, watch: Promise<T>, timeout = 30000) {
    this.rejected = false;
    this.stopped = false;
    this.peripheral = peripheral;
    this.reject = this._reject.bind(this);

    this.peripheral.once('disconnect', this.reject);

    const watchPromise = watch.finally(() => this.stop());

    const timeoutPromise = new Promise<void>((_resolve, reject) => {
      this.rejectFn = reject;
      this.timer = setTimeout(() => {
        this._reject('Timeout');
      }, timeout);
    });

    this.promise = <Promise<T>>Promise.race([watchPromise, timeoutPromise]);
  }

  /**
   * Get the promise associated with this watcher.
   *
   * @returns {Promise} The promise.
   */
  getPromise(): Promise<T> {
    return this.promise;
  }

  /**
   * Call the reject function with the provided reason.
   *
   * @param {string?} reason - Reject reason
   */
  private _reject(reason = 'Disconnected'): void {
    if (this.rejected || this.stopped) {
      return;
    }

    this.rejected = true;
    this.rejectFn!(reason);
  }

  /**
   * Stop the watcher.
   */
  stop(): void {
    this.stopped = true;

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.peripheral.removeListener('disconnect', this.reject);
  }
}

/**
 * Queue used for serializing BLE operations.
 */
export class OpQueue {
  private _current: Promise<unknown>;

  /**
   * Create the queue.
   */
  constructor() {
    this._current = Promise.resolve();
  }

  /**
   * Queue a new operation.
   *
   * @param {function} op - Function to queue
   * @returns {Promise} Promise which resolves when the function has executed.
   */
  queue<T>(op: () => Promise<T>): Promise<T> {
    const ret = new Promise<T>((resolve, reject) => {
      this._current.then(() => {
        op().then(resolve, reject);
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    this._current = ret.catch(() => {});
    return ret;
  }
}
