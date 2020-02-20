/**
 * Class for dealing with HAP TLV data.
 */
'use strict';

const kTLVType_Separator = 255;

/**
 * Decode a buffer into a TLV object.
 *
 * See Chapter 12.1
 *
 * @param {Buffer} buffer - Buffer to decode
 * @returns {Map} TLV object
 */
function decodeBuffer(buffer) {
  let position = 0;
  let lastTag = -1;
  const result = new Map();

  if (!Buffer.isBuffer(buffer)) {
    return result;
  }

  while (position < buffer.length) {
    const tag = buffer.readUInt8(position++);
    const length = buffer.readUInt8(position++);
    const value = buffer.slice(position, position + length);

    if (result.has(tag)) {
      const existingValue = result.get(tag);
      if (Array.isArray(existingValue) && tag === lastTag) {
        const idx = existingValue.length - 1;
        const newValue = Buffer.allocUnsafe(existingValue[idx].length + length);
        existingValue[idx].copy(newValue, 0);
        value.copy(newValue, existingValue[idx].length);
        existingValue[idx] = newValue;
      } else if (Array.isArray(existingValue)) {
        existingValue.push(value);
      } else if (tag === lastTag) {
        const newValue = Buffer.allocUnsafe(existingValue.length + length);
        existingValue.copy(newValue, 0);
        value.copy(newValue, existingValue.length);
        result.set(tag, newValue);
      } else {
        result.set(tag, [existingValue, value]);
      }
    } else {
      result.set(tag, value);
    }

    position += length;
    lastTag = tag;
  }

  return result;
}

/**
 * Encode a TLV object into a buffer.
 *
 * See Chapter 12.1
 *
 * @param {Map} object - TLV object to encode
 * @returns {Buffer} Encoded buffer
 */
function encodeObject(object) {
  const tlvs = [];

  // eslint-disable-next-line prefer-const
  for (let [tag, value] of object) {
    tag = parseInt(tag, 10);

    if (tag < 0 || tag > 255) {
      continue;
    }

    if (tag === kTLVType_Separator) {
      tlvs.push(Buffer.from([kTLVType_Separator, 0]));
      continue;
    }

    let values;
    if (Array.isArray(value)) {
      values = value;
    } else {
      values = [value];
    }

    let valueIdx = 0;
    while (valueIdx < values.length) {
      let position = 0;
      while (values[valueIdx].length - position > 0) {
        const length = Math.min(values[valueIdx].length - position, 255);

        const tlv = Buffer.allocUnsafe(length + 2);
        tlv.writeUInt8(tag, 0);
        tlv.writeUInt8(length, 1);
        values[valueIdx].copy(tlv, 2, position, position + length);

        tlvs.push(tlv);
        position += length;
      }

      if (++valueIdx < values.length) {
        tlvs.push(Buffer.from([kTLVType_Separator, 0]));
      }
    }
  }

  return Buffer.concat(tlvs);
}

module.exports = {
  decodeBuffer,
  encodeObject,
};
