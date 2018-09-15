'use strict';

const GattConstants = require('./gatt-constants');
const TLV = require('../../model/tlv');

class BLEProtocol {
  buildCharacteristicSignatureReadRequest(tid, iid) {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(
      GattConstants.Opcodes['HAP-Characteristic-Signature-Read'],
      1
    );
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    return buf;
  }

  parseCharacteristicSignatureReadResponse(buf) {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
      length: buf.readUInt16LE(3),
      tlv: TLV.decodeBuffer(buf.slice(5, buf.length)),
    };
  }

  buildCharacteristicWriteRequest(tid, iid, tlv) {
    let body;
    if (Buffer.isBuffer(tlv)) {
      body = tlv;
    } else {
      body = TLV.encodeObject(tlv);
    }

    const buf = Buffer.alloc(7 + body.length);
    buf.writeUInt8(
      GattConstants.Opcodes['HAP-Characteristic-Write'],
      1
    );
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    buf.writeUInt16LE(body.length, 5);
    body.copy(buf, 7);
    return buf;
  }

  parseCharacteristicWriteResponse(buf) {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
    };
  }

  buildCharacteristicReadRequest(tid, iid) {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(
      GattConstants.Opcodes['HAP-Characteristic-Read'],
      1
    );
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    return buf;
  }

  parseCharacteristicReadResponse(buf) {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
      length: buf.readUInt16LE(3),
      tlv: TLV.decodeBuffer(buf.slice(5, buf.length)),
    };
  }

  buildCharacteristicTimedWriteRequest(tid, iid, tlv) {
    const body = TLV.encodeObject(tlv);

    const buf = Buffer.alloc(7 + body.length);
    buf.writeUInt8(
      GattConstants.Opcodes['HAP-Characteristic-Timed-Write'],
      1
    );
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    buf.writeUInt16LE(body.length, 5);
    body.copy(buf, 7);
    return buf;
  }

  parseCharacteristicTimedWriteResponse(buf) {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
    };
  }

  buildCharacteristicExecuteWriteRequest(tid, iid) {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(
      GattConstants.Opcodes['HAP-Characteristic-Execute-Write'],
      1
    );
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    return buf;
  }

  parseCharacteristicExecuteWriteResponse(buf) {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
    };
  }

  buildServiceSignatureReadRequest(tid, sid) {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(
      GattConstants.Opcodes['HAP-Service-Signature-Read'],
      1
    );
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(sid, 3);
    return buf;
  }

  parseServiceSignatureReadResponse(buf) {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
      length: buf.readUInt16LE(3),
      tlv: TLV.decodeBuffer(buf.slice(5, buf.length)),
    };
  }
}

module.exports = BLEProtocol;
