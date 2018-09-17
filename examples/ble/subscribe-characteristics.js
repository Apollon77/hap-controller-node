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
    format: 'bool',
  },
];

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new GattClient(
    service.DeviceID,
    service.peripheral,
    pairingData
  );

  let count = 0;
  client.on('event', (ev) => {
    console.log(JSON.stringify(ev, null, 2));

    if (++count >= 2) {
      client.unsubscribeCharacteristics(characteristics)
        .then(() => console.log('Unsubscribed!'))
        .catch((e) => console.error(e));
    }
  });

  client.subscribeCharacteristics(characteristics)
    .then(() => console.log('Subscribed!'))
    .catch((e) => console.error(e));
});
discovery.start();
