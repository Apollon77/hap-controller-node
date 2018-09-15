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
 * @returns {Object} TLV object
 */
function decodeBuffer(buffer) {
  let position = 0;
  let lastTag = -1;
  const result = {};

  while (position < buffer.length) {
    const tag = buffer.readUInt8(position++);
    const length = buffer.readUInt8(position++);
    const value = buffer.slice(position, position + length);

    if (result.hasOwnProperty(tag)) {
      if (Array.isArray(result[tag]) && tag === lastTag) {
        const idx = result[tag].length - 1;
        const newValue = Buffer.allocUnsafe(result[tag][idx].length + length);
        result[tag][idx].copy(newValue, 0);
        value.copy(newValue, result[tag][idx].length);
        result[tag][idx] = newValue;
      } else if (Array.isArray(result[tag])) {
        result[tag].push(value);
      } else if (tag === lastTag) {
        const newValue = Buffer.allocUnsafe(result[tag].length + length);
        result[tag].copy(newValue, 0);
        value.copy(newValue, result[tag].length);
        result[tag] = newValue;
      } else {
        result[tag] = [result[tag], value];
      }
    } else {
      result[tag] = value;
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
 * @param {Object} object - TLV object to encode
 * @returns {Buffer} Encoded buffer
 */
function encodeObject(object) {
  const tlvs = [];

  for (let tag in object) {
    tag = parseInt(tag, 10);

    if (tag < 0 || tag > 255) {
      continue;
    }

    if (tag === kTLVType_Separator) {
      tlvs.push(Buffer.from([kTLVType_Separator, 0]));
      continue;
    }

    const value = object[tag];
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
