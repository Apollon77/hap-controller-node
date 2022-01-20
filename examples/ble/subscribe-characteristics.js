const { BLEDiscovery, GattClient } = require('hap-controller');

const discovery = new BLEDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

const characteristics = [
    {
        serviceUuid: '...', // the "type" property
        characteristicUuid: '...', // the "type" property
        iid: 10,
        format: 'bool',
    },
];

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new GattClient(service.DeviceID, service.peripheral, pairingData);

    let count = 0;
    client.on('event', async (ev) => {
        console.log(JSON.stringify(ev, null, 2));

        if (++count >= 2) {
            try {
                await client.unsubscribeCharacteristics(characteristics);
                console.log(`${service.name}: Unsubscribed!`);
            } catch (e) {
                console.error(`${service.name}:`, e);
            }
        }
    });

    client.on('event-disconnect', (formerSubscribes) => {
        console.log(JSON.stringify(formerSubscribes, null, 2));

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
