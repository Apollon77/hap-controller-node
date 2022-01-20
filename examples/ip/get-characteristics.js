const { HttpClient, IPDiscovery } = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

const characteristics = [
    '1.10', // aid.iid
];

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new HttpClient(service.id, service.address, service.port, pairingData, {
        usePersistentConnections: true,
    });

    try {
        const ch = await client.getCharacteristics(characteristics, {
            meta: true,
            perms: true,
            type: true,
            ev: true,
        });
        client.close();
        console.log(JSON.stringify(ch, null, 2));
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
