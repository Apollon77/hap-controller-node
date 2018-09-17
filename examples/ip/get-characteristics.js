const {HttpClient, IPDiscovery} = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
  AccessoryPairingID: '...',
  AccessoryLTPK: '...',
  iOSDevicePairingID: '...',
  iOSDeviceLTSK: '...',
  iOSDeviceLTPK: '...',
};

const characteristics = [
  '1.10',  // aid.iid
];

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new HttpClient(
    service.id,
    service.address,
    service.port,
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
