const { HttpClient, IPDiscovery } = require('hap-controller');

const discovery = new IPDiscovery();

const pin = 'XXX-YY-ZZZ';

discovery.on('serviceUp', (service) => {
  console.log('Found device! ', service.name);

  const client = new HttpClient(service.id, service.address, service.port);
  client
    .pairSetup(pin) // same as when using second parameter with PairingMethods.PairSetupWithAuth
    .then(() => {
      console.log(service.name, ' Paired! Keep the following pairing data safe:');
      console.log(JSON.stringify(client.getLongTermData(), null, 2));
    })
    .catch((e) => console.error(service.name, ' ', e));
});
discovery.start();
