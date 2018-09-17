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

  let count = 0, connection;
  client.on('event', (ev) => {
    console.log(JSON.stringify(ev, null, 2));

    if (++count >= 2) {
      client.unsubscribeCharacteristics(characteristics, connection)
        .then(() => console.log('Unsubscribed!'))
        .catch((e) => console.error(e));
    }
  });

  client.subscribeCharacteristics(characteristics)
    .then((conn) => {
      connection = conn;
      console.log('Subscribed!');
    }).catch((e) => console.error(e));
});
discovery.start();
