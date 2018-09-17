const {BLEDiscovery, GattClient, GattUtils} = require('hap-controller');

const discovery = new BLEDiscovery();

const pairingData = {
  AccessoryPairingID: '...',
  AccessoryLTPK: '...',
  iOSDevicePairingID: '...',
  iOSDeviceLTSK: '...',
  iOSDeviceLTPK: '...',
};

const characteristics = [
  {
    serviceUuid: '...',         // the "type" property
    characteristicUuid: '...',  // the "type" property
    iid: 10,
    value: GattUtils.valueToBuffer(true, 'bool'),
  },
];

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new GattClient(
    service.DeviceID,
    service.peripheral,
    pairingData
  );

  client.setCharacteristics(characteristics)
    .then(() => console.log('Done!'))
    .catch((e) => console.error(e));
});
discovery.start();
