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
        format: 'bool', // if known
    },
];

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new GattClient(service.DeviceID, service.peripheral, pairingData);

    try {
        const ch = await client.getCharacteristics(characteristics, {
            meta: true,
            perms: true,
            type: true,
            ev: true,
        });
        console.log(JSON.stringify(ch, null, 2));
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
