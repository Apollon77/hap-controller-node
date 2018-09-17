const {BLEDiscovery, GattClient} = require('hap-controller');

const discovery = new BLEDiscovery();

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new GattClient(service.DeviceID, service.peripheral);
  client.identify()
    .then(() => console.log('Done!'))
    .catch((e) => console.error(e));
});
discovery.start();
