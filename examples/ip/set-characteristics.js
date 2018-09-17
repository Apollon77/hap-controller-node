const {HttpClient, IPDiscovery} = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
  AccessoryPairingID: '...',
  AccessoryLTPK: '...',
  iOSDevicePairingID: '...',
  iOSDeviceLTSK: '...',
  iOSDeviceLTPK: '...',
};

const characteristics = {
  '1.10': true,
};

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new HttpClient(
    service.id,
    service.address,
    service.port,
    pairingData
  );

  client.setCharacteristics(characteristics)
    .then(() => console.log('Done!'))
    .catch((e) => console.error(e));
});
discovery.start();
