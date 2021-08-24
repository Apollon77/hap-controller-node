const { HttpClient, IPDiscovery } = require('hap-controller');

const discovery = new IPDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

discovery.on('serviceUp', (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new HttpClient(service.id, service.address, service.port, pairingData);

    client
        .removePairing(client.pairingProtocol.iOSDevicePairingID)
        .then(() => console.log(`${service.name}: done!`))
        .catch((e) => console.error(`${service.name}:`, e));
});
discovery.start();
