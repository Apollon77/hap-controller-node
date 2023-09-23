const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout,
});

const { HttpClient, IPDiscovery } = require('hap-controller');

const discovery = new IPDiscovery();

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}: Available for pairing: ${service.availableToPair}`);

    if (service.availableToPair) {
        try {
            const pairMethod = await discovery.getPairMethod(service);

            const client = new HttpClient(service.id, service.address, service.port);

            const data = await client.startPairing(pairMethod);
            readline.question('Enter PIN: ', async (pin) => {
                try {
                    await client.finishPairing(data, pin);
                    console.log(`${service.name} paired! Keep the following pairing data safe:`);
                    console.log(JSON.stringify(client.getLongTermData(), null, 2));
                    client.close();
                } catch (e) {
                    console.error(`${service.name}: Error`, e);
                }
            });
        } catch (e) {
            console.error(`${service.name}: Error`, e);
        }
    }
});

discovery.start();
