const { BLEDiscovery, GattClient, GattUtils } = require('hap-controller');

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
        value: GattUtils.valueToBuffer(true, 'bool'),
    },
];

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new GattClient(service.DeviceID, service.peripheral, pairingData);

    try {
        await client.setCharacteristics(characteristics);
        console.log(`${service.name}: Done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
