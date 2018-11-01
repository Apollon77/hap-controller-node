'use strict';

/**
 * Convert a proper UUID to noble's format.
 *
 * @param {string} uuid - UUID to convert
 * @returns {string} UUID
 */
function uuidToNobleUuid(uuid) {
  return uuid.toLowerCase().replace(/-/g, '');
}

/**
 * Convert a UUID in noble's format to a proper UUID.
 *
 * @param {string} uuid - UUID to convert
 * @returns {string} UUID
 */
function nobleUuidToUuid(uuid) {
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
function bufferToValue(buffer, format) {
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
      return buffer.readUInt32LE(0) || (buffer.readUInt32LE(4) << 32);
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
function valueToBuffer(value, format) {
  switch (format) {
    case 'bool':
      return Buffer.from([value ? 1 : 0]);
    case 'uint8':
      return Buffer.from([value & 0xff]);
    case 'uint16': {
      const b = Buffer.alloc(2);
      b.writeUInt16LE(value, 0);
      return b;
    }
    case 'uint32': {
      const b = Buffer.alloc(4);
      b.writeUInt32LE(value, 0);
      return b;
    }
    case 'uint64': {
      const b = Buffer.alloc(8);
      b.writeUInt32LE(value & 0xffffffff, 0);
      b.writeUInt32LE(value >> 32, 4);
      return b;
    }
    case 'int': {
      const b = Buffer.alloc(4);
      b.writeInt32LE(value);
      return b;
    }
    case 'float': {
      const b = Buffer.alloc(4);
      b.writeFloatLE(value);
      return b;
    }
    case 'string':
      return Buffer.from(value);
    case 'data':
      if (typeof value === 'string') {
        return Buffer.from(value, 'base64');
      }

      return value;
    default:
      throw new Error(`Unknown format type: ${format}`);
  }
}

/**
 * This should be used when doing any communication with a BLE device, since
 * noble doesn't provide any timeout functionality.
 */
class Watcher {
  /**
   * Initialize the Watcher object.
   *
   * @param {Object} peripheral - The noble peripheral object
   * @param {function} rejectFn - The reject function to call on disconnect or
   *                              timeout
   * @param {number?} timeout - Timeout
   */
  constructor(peripheral, rejectFn, timeout = 10000) {
    this.rejected = false;
    this.peripheral = peripheral;
    this.rejectFn = rejectFn;
    this.reject = this._reject.bind(this);

    this.peripheral.once('disconnect', this.reject);

    if (typeof timeout === 'number') {
      this.timer = setTimeout(() => {
        this._reject('Timeout');
      }, timeout);
    }
  }

  /**
   * Call the reject function with the provided reason.
   *
   * @param {string?} reason - Reject reason
   */
  _reject(reason = 'Disconnected') {
    if (this.rejected) {
      return;
    }

    this.rejected = true;
    this.rejectFn(reason);
  }

  /**
   * Stop the watcher.
   */
  stop() {
    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.peripheral.removeListener('disconnect', this.reject);
  }
}

module.exports = {
  bufferToValue,
  nobleUuidToUuid,
  uuidToNobleUuid,
  valueToBuffer,
  Watcher,
};
