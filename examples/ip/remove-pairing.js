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

    const client = new HttpClient(service.id, service.address, service.port, pairingData);

    try {
        await client.removePairing(client.pairingProtocol.iOSDevicePairingID);
        client.close();
        console.log(`${service.name}: done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
