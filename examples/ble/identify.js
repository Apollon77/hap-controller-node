const { BLEDiscovery, GattClient } = require('hap-controller');

const discovery = new BLEDiscovery();

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new GattClient(service.DeviceID, service.peripheral);

    try {
        await client.identify();
        console.log(`${service.name}: Done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
