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

  client.removePairing(client.pairingProtocol.iOSDevicePairingID)
    .then(() => console.log('Done!'))
    .catch((e) => console.error(e));
});
discovery.start();
