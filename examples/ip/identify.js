const { HttpClient, IPDiscovery } = require('hap-controller');
const discovery = new IPDiscovery();

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new HttpClient(service.id, service.address, service.port);

    try {
        await client.identify();
        client.close(); // Not needed if only identify was called, else needed
        console.log(`${service.name}: Done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});
discovery.start();
