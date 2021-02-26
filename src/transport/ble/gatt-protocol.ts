import * as GattConstants from './gatt-constants';
import { decodeBuffer, encodeObject, TLV } from '../../model/tlv';

export interface GattResponse {
  controlField: number;
  tid: number;
  status: number;
  length?: number;
  tlv?: TLV;
}

export default class BLEProtocol {
  buildCharacteristicSignatureReadRequest(tid: number, iid: number): Buffer {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(GattConstants.Opcodes['HAP-Characteristic-Signature-Read'], 1);
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    return buf;
  }

  parseCharacteristicSignatureReadResponse(buf: Buffer): GattResponse {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
      length: buf.readUInt16LE(3),
      tlv: decodeBuffer(buf.slice(5, buf.length)),
    };
  }

  buildCharacteristicWriteRequest(tid: number, iid: number, tlv: TLV): Buffer {
    let body;
    if (Buffer.isBuffer(tlv)) {
      body = tlv;
    } else {
      body = encodeObject(tlv);
    }

    const buf = Buffer.alloc(7 + body.length);
    buf.writeUInt8(GattConstants.Opcodes['HAP-Characteristic-Write'], 1);
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    buf.writeUInt16LE(body.length, 5);
    body.copy(buf, 7);
    return buf;
  }

  parseCharacteristicWriteResponse(buf: Buffer): GattResponse {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
    };
  }

  buildCharacteristicReadRequest(tid: number, iid: number): Buffer {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(GattConstants.Opcodes['HAP-Characteristic-Read'], 1);
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    return buf;
  }

  parseCharacteristicReadResponse(buf: Buffer): GattResponse {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
      length: buf.readUInt16LE(3),
      tlv: decodeBuffer(buf.slice(5, buf.length)),
    };
  }

  buildCharacteristicTimedWriteRequest(tid: number, iid: number, tlv: TLV): Buffer {
    const body = encodeObject(tlv);

    const buf = Buffer.alloc(7 + body.length);
    buf.writeUInt8(GattConstants.Opcodes['HAP-Characteristic-Timed-Write'], 1);
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    buf.writeUInt16LE(body.length, 5);
    body.copy(buf, 7);
    return buf;
  }

  parseCharacteristicTimedWriteResponse(buf: Buffer): GattResponse {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
    };
  }

  buildCharacteristicExecuteWriteRequest(tid: number, iid: number): Buffer {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(GattConstants.Opcodes['HAP-Characteristic-Execute-Write'], 1);
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(iid, 3);
    return buf;
  }

  parseCharacteristicExecuteWriteResponse(buf: Buffer): GattResponse {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
    };
  }

  buildServiceSignatureReadRequest(tid: number, sid: number): Buffer {
    const buf = Buffer.alloc(5);
    buf.writeUInt8(GattConstants.Opcodes['HAP-Service-Signature-Read'], 1);
    buf.writeUInt8(tid, 2);
    buf.writeUInt16LE(sid, 3);
    return buf;
  }

  parseServiceSignatureReadResponse(buf: Buffer): GattResponse {
    return {
      controlField: buf.readUInt8(0),
      tid: buf.readUInt8(1),
      status: buf.readUInt8(2),
      length: buf.readUInt16LE(3),
      tlv: decodeBuffer(buf.slice(5, buf.length)),
    };
  }
}
