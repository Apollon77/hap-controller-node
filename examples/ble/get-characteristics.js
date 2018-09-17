const {BLEDiscovery, GattClient} = require('hap-controller');

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
    format: 'bool',             // if known
  },
];

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new GattClient(
    service.DeviceID,
    service.peripheral,
    pairingData
  );

  client.getCharacteristics(
    characteristics,
    {
      meta: true,
      perms: true,
      type: true,
      ev: true,
    }
  ).then((ch) => {
    console.log(JSON.stringify(ch, null, 2));
  }).catch((e) => console.error(e));
});
discovery.start();
