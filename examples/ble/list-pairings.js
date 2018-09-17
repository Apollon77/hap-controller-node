const {BLEDiscovery, GattClient} = require('hap-controller');

const discovery = new BLEDiscovery();

const pairingData = {
  AccessoryPairingID: '...',
  AccessoryLTPK: '...',
  iOSDevicePairingID: '...',
  iOSDeviceLTSK: '...',
  iOSDeviceLTPK: '...',
};

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new GattClient(
    service.DeviceID,
    service.peripheral,
    pairingData
  );

  client.listPairings().then((tlv) => {
    console.log(JSON.stringify(tlv, null, 2));
  }).catch((e) => console.error(e));
});
discovery.start();
