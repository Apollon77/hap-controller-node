const { HttpClient, IPDiscovery } = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new HttpClient(service.id, service.address, service.port, pairingData, {
        usePersistentConnections: true,
    });

    try {
        const tlv = await client.listPairings();
        console.log(JSON.stringify(tlv, null, 2));
        client.close();
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
