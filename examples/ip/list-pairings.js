const {HttpClient, IPDiscovery} = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
  AccessoryPairingID: '...',
  AccessoryLTPK: '...',
  iOSDevicePairingID: '...',
  iOSDeviceLTSK: '...',
  iOSDeviceLTPK: '...',
};

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new HttpClient(
    service.id,
    service.address,
    service.port,
    pairingData
  );

  client.listPairings().then((tlv) => {
    console.log(JSON.stringify(tlv, null, 2));
  }).catch((e) => console.error(e));
});
discovery.start();
