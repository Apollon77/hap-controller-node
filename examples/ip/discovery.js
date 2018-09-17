const {IPDiscovery} = require('hap-controller');

const discovery = new IPDiscovery();

discovery.on('serviceUp', (service) => {
  console.log('Found device:', service);
});
discovery.start();
