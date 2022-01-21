const { HttpClient, IPDiscovery } = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

const characteristics = {
    '1.10': true,
};

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new HttpClient(service.id, service.address, service.port, pairingData, {
        usePersistentConnections: true,
    });

    try {
        await client.setCharacteristics(characteristics);
        client.close();
        console.log(`${service.name}: done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
