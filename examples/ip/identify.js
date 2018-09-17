const {HttpClient, IPDiscovery} = require('hap-controller');

const discovery = new IPDiscovery();

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new HttpClient(service.id, service.address, service.port);
  client.identify()
    .then(() => console.log('Done!'))
    .catch((e) => console.error(e));
});
discovery.start();
