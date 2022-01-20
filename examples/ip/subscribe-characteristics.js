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

    const client = new HttpClient(service.id, service.address, service.port, pairingData);

    let count = 0;
    client.on('event', async (ev) => {
        console.log(`Event: ${JSON.stringify(ev, null, 2)}`);

        if (++count >= 2) {
            try {
                await client.unsubscribeCharacteristics(characteristics);
                client.close();
                console.log(`${service.name}: Unsubscribed!`);
            } catch (e) {
                console.error(`${service.name}:`, e);
            }
        }
    });

    client.on('event-disconnect', (formerSubscribes) => {
        console.log(`Disconnected: ${JSON.stringify(formerSubscribes, null, 2)}`);

        // resubscribe if wanted:
        // await client.subscribeCharacteristics(formerSubscribes);
    });

    try {
        await client.subscribeCharacteristics(characteristics);
        console.log(`${service.name}: Subscribed!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
