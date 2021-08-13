//const { HttpClient, IPDiscovery } = require('hap-controller');
const { HttpClient, IPDiscovery } = require('../../lib/index');
const discovery = new IPDiscovery();

discovery.on('serviceUp', (service) => {
  console.log('Found device! ', service);

  const client = new HttpClient(service.id, service.address, service.port);
  client
    .identify()
    .then(() => console.log(service.name, ': Done!'))
    .catch((e) => console.error(service.name, ': ', e));
});
discovery.start();
