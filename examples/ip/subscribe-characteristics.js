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

    client.on('event-disconnect', async (formerSubscribes) => {
        console.log(`Disconnected: ${JSON.stringify(formerSubscribes, null, 2)}`);
        // resubscribe if wanted:
        try {
            // a disconnect can happen if the device was disconnected from the network
            // so you have to catch any network errors here
            await client.subscribeCharacteristics(formerSubscribes);
        } catch (e) {
            console.error('error while resubscribing', e);
            // if the discovery will detect the device again it will fire a new serviceUp event
        }
    });

    try {
        await client.subscribeCharacteristics(characteristics);
        console.log(`${service.name}: Subscribed!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
