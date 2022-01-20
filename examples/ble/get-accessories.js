const { BLEDiscovery, GattClient } = require('hap-controller');

const discovery = new BLEDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new GattClient(service.DeviceID, service.peripheral, pairingData);

    try {
        const acc = await client.getAccessories();
        console.log(JSON.stringify(acc, null, 2));
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
