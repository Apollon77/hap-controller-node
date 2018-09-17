const {BLEDiscovery} = require('hap-controller');

const discovery = new BLEDiscovery();

discovery.on('serviceUp', (service) => {
  console.log('Found device:', service);
});
discovery.start();
