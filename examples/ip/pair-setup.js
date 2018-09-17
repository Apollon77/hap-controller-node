const {HttpClient, IPDiscovery} = require('hap-controller');

const discovery = new IPDiscovery();

const pin = 'XXX-YY-ZZZ';

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new HttpClient(service.id, service.address, service.port);
  client.pairSetup(pin).then(() => {
    console.log('Paired! Keep the following pairing data safe:');
    console.log(JSON.stringify(client.getLongTermData(), null, 2));
  }).catch((e) => console.error(e));
});
discovery.start();
