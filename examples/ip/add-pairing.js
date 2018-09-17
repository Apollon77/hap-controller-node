const {HttpClient, IPDiscovery} = require('hap-controller');
const sodium = require('libsodium-wrappers');

const discovery = new IPDiscovery();

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

discovery.on('serviceUp', (service) => {
  console.log('Found device!');

  const client = new HttpClient(
    service.id,
    service.address,
    service.port,
    pairingData
  );

  client.addPairing(identifier, Buffer.from(key.publicKey), isAdmin)
    .then(() => console.log('Done!'))
    .catch((e) => console.error(e));
});
discovery.start();
