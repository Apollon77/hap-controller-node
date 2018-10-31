/**
 * BLE discovery wrappers for finding HAP devices.
 */
'use strict';

const EventEmitter = require('events');
const noble = require('noble');

class BLEDiscovery extends EventEmitter {
  /**
   * Start searching for BLE HAP devices.
   *
   * @param {boolean} allowDuplicates - Allow duplicate serviceUp events. This
   *                  is needed for disconnected events, where the GSN is
   *                  updated in the advertisement.
   */
  start(allowDuplicates = false) {
    noble.on('stateChange', (state) => {
      if (state === 'poweredOn') {
        noble.startScanning([], allowDuplicates, (e) => {
          console.error('noble failed to start scanning:', e);
        });
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
          manufacturerData.length < 17) {
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

      if (CoID !== 0x4C || TY !== 0x06 || CV !== 0x02) {
        return;
      }

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
