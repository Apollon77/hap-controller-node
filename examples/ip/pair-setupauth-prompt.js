const readline = require('readline').createInterface({
  input: process.stdin,
  output: process.stdout,
});

const { HttpClient, IPDiscovery } = require('../../lib');

const discovery = new IPDiscovery();

discovery.on('serviceUp', async (service) => {
  console.log(`Found device: ${service.name}`);

  const client = new HttpClient(service.id, service.address, service.port);

  const data = await client.startPairing();
  readline.question('Enter PIN: ', async (pin) => {
    await client.finishPairing(data, pin);
    console.log(`${service.name} paired! Keep the following pairing data safe:`);
    console.log(JSON.stringify(client.getLongTermData(), null, 2));
  });
});
discovery.start();
