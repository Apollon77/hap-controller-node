const { BLEDiscovery, GattClient } = require('hap-controller');

const discovery = new BLEDiscovery();

const pin = 'XXX-YY-ZZZ';

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}: Available for pairing: ${service.availableToPair}`);

    if (service.availableToPair) {
        try {
            const pairMethod = await discovery.getPairingMethod(service);

            const client = new GattClient(service.DeviceID, service.peripheral);
            await client.pairSetup(pin, pairMethod);

            console.log('Paired! Keep the following pairing data safe:');
            console.log(JSON.stringify(client.getLongTermData(), null, 2));
        } catch (e) {
            console.error(`${service.name}: ${e}`);
        }
    }
});
discovery.start();
