const { HttpClient, IPDiscovery, PairingMethods } = require('hap-controller');

const discovery = new IPDiscovery();

const pin = 'XXX-YY-ZZZ';

discovery.on('serviceUp', (service) => {
  console.log(`Found device: ${service.name}`);

  const client = new HttpClient(service.id, service.address, service.port);
  client
    .pairSetup(pin, PairingMethods.PairSetup, 0)
    .then(() => {
      console.log(`${service.name} paired! Keep the following pairing data safe:`);
      console.log(JSON.stringify(client.getLongTermData(), null, 2));
    })
    .catch((e) => console.error(service.name, ' ', e));
});
discovery.start();
