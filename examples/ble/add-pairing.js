const { BLEDiscovery, GattClient } = require('hap-controller');
const sodium = require('libsodium-wrappers');

const discovery = new BLEDiscovery();

const pairingData = {
    AccessoryPairingID: '...',
    AccessoryLTPK: '...',
    iOSDevicePairingID: '...',
    iOSDeviceLTSK: '...',
    iOSDeviceLTPK: '...',
};

const seed = Buffer.from(sodium.randombytes_buf(32));
const key = sodium.crypto_sign_seed_keypair(seed);
const identifier = 'abcdefg';
const isAdmin = false;

discovery.on('serviceUp', async (service) => {
    console.log(`Found device: ${service.name}`);

    const client = new GattClient(service.DeviceID, service.peripheral, pairingData);

    try {
        await client.addPairing(identifier, Buffer.from(key.publicKey), isAdmin);
        console.log(`${service.name}: Done!`);
    } catch (e) {
        console.error(`${service.name}:`, e);
    }
});

discovery.start();
