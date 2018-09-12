/**
 * BLE discovery wrappers for finding HAP devices.
 */
'use strict';

const EventEmitter = require('events');
const noble = require('noble');

// eslint-disable-next-line no-unused-vars
const HapBleProtocolInformationServiceUuid = '000000a20000100080000026bb765291';
// eslint-disable-next-line no-unused-vars
const ProtocolVersionCharacteristicUuid = '000000370000100080000026bb765291';

class BLEDiscovery extends EventEmitter {
  /**
   * Start searching for BLE HAP devices.
   *
   * The serviceUpCallback is called when a new HAP device is found, and is
   * passed an object containing the HAP advertisement parameters.
   */
  start() {
    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {
        noble.startScanning();
      } else {
        noble.stopScanning();
      }
    });

    noble.on('discover', (peripheral) => {
      const advertisement = peripheral.advertisement;
      const manufacturerData = advertisement.manufacturerData;

      if (!advertisement ||
          !advertisement.localName ||
          !manufacturerData ||
          manufacturerData.length !== 17) {
        return;
      }

      // See Chapter 6.4.2.2
      const localName = advertisement.localName;
      const CoID = manufacturerData.readUInt16LE(0);
      const TY = manufacturerData.readUInt8(2);
      const AIL = manufacturerData.readUInt8(3);
      const SF = manufacturerData.readUInt8(4);
      const deviceID = manufacturerData.slice(5, 11);
      const ACID = manufacturerData.readUInt16LE(11);
      const GSN = manufacturerData.readUInt16LE(13);
      const CN = manufacturerData.readUInt8(15);
      const CV = manufacturerData.readUInt8(16);

      let formattedId = '';
      for (const b of deviceID) {
        formattedId += `${b.toString(16)}:`;
      }
      formattedId = formattedId.substr(0, 17);

      this.emit(
        'serviceUp',
        {
          name: localName,
          CoID,
          TY,
          AIL,
          SF,
          DeviceID: formattedId,
          ACID,
          GSN,
          CN,
          CV,
          peripheral,
        }
      );
    });
  }

  /**
   * Stop an ongoing discovery process.
   */
  stop() {
    noble.stopScanning();
  }
}

module.exports = BLEDiscovery;
