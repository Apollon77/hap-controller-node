# hap-controller

![npm](https://img.shields.io/npm/v/hap-controller.svg)
![GitHub License](https://img.shields.io/github/license/mrstegeman/hap-controller-node.svg)
![Dependency status](https://david-dm.org/mrstegeman/hap-controller-node.svg)

This library allows you to build a HomeKit controller, capable of discovering and controlling both WiFi and BLE devices.

## Installation

Use `npm` to install the package:

```bash
npm install hap-controller

# OR

yarn add hap-controller
```

## Usage

The IP and BLE APIs are very similar and only differ where it makes sense, given protocol differences.

### Device Discovery

```javascript
const {BLEDiscovery, IPDiscovery} = require('hap-controller');

const ipDiscovery = new IPDiscovery();
ipDiscovery.on('serviceUp', (service) => {
  // ...
});
ipDiscovery.start();

const bleDiscovery = new BLEDiscovery();
bleDiscovery.on('serviceUp', (service) => {
  // ...
});
bleDiscovery.start();  // pass true if disconnected events are needed
```

### Identify

```javascript
const {GattClient, HttpClient} = require('hap-controller');

const ipClient = new HttpClient(id, address, port);
ipClient.identify().then(() => {
  // ...
}).catch((e) => console.error(e));

const bleClient = new GattClient(id, peripheral);
bleClient.identify().then(() => {
  // ...
}).catch((e) => console.error(e));
```

### Pair Setup

```javascript
const {GattClient, HttpClient} = require('hap-controller');

const ipClient = new HttpClient(id, address, port);
ipClient.pairSetup(pin).then(() => {
  // keep this data
  console.log(JSON.stringify(ipClient.getLongTermData(), null, 2));
}).catch((e) => console.error(e));

const bleClient = new GattClient(id, peripheral);
bleClient.pairSetup(pin).then(() => {
  // keep this data
  console.log(JSON.stringify(bleClient.getLongTermData(), null, 2));
}).catch((e) => console.error(e));
```

### Manage Pairings

```javascript
const {GattClient, HttpClient} = require('hap-controller');

const ipClient = new HttpClient(id, address, port, pairingData);
ipClient.listPairings().then(() => {
  // ...
}).catch((e) => console.error(e));

ipClient.removePairing(identifier).then(() => {
  // ...
}).catch((e) => console.error(e));

const bleClient = new GattClient(id, peripheral, pairingData);
bleClient.listPairings().then(() => {
  // ...
}).catch((e) => console.error(e));

bleClient.removePairing(identifier).then(() => {
  // ...
}).catch((e) => console.error(e));
```

### Accessory Database

```javascript
const {GattClient, HttpClient} = require('hap-controller');

const ipClient = new HttpClient(id, address, port, pairingData);
ipClient.getAccessories().then((accessories) => {
  // ...
}).catch((e) => console.error(e));

const bleClient = new GattClient(id, peripheral, pairingData);
bleClient.getAccessories().then((accessories) => {
  // ...
}).catch((e) => console.error(e));
```

### Get/Set Characteristics

```javascript
const {GattClient, GattUtils, HttpClient} = require('hap-controller');

const ipClient = new HttpClient(id, address, port, pairingData);
ipClient.getCharacteristics(
  ['1.10'],
  {
    meta: true,
    perms: true,
    type: true,
    ev: true,
  }
).then((characteristics) => {
  // ...
}).catch((e) => console.error(e));

ipClient.setCharacteristics({'1.10': true}).then(() => {
  // ...
}).catch((e) => console.error(e));

const bleClient = new GattClient(id, peripheral, pairingData);
bleClient.getCharacteristics(
  [
    {
      serviceUuid: '...',         // the "type" property
      characteristicUuid: '...',  // the "type" property
      iid: 10,
      format: 'bool',             // if known
    },
  ],
  {
    meta: true,
    perms: true,
    type: true,
    ev: true,
  }
).then((characteristics) => {
  // ...
}).catch((e) => console.error(e));

bleClient.setCharacteristics(
  [
    {
      serviceUuid: '...',         // the "type" property
      characteristicUuid: '...',  // the "type" property
      iid: 10,
      value: GattUtils.valueToBuffer(true, 'bool'),
    },
  ]
).then(() => {
  // ...
}).catch((e) => console.error(e));
```

### Subscribe/Unsubscribe Characteristics

```javascript
const {GattClient, HttpClient} = require('hap-controller');

const ipClient = new HttpClient(id, address, port, pairingData);

ipClient.on('event', (ev) => {
  // ...
});

let connection;
ipClient.subscribeCharacteristics(['1.10']).then((conn) => {
  connection = conn;
  // ...
}).catch((e) => console.error(e));

ipClient.unsubscribeCharacteristics(['1.10'], connection).then(() => {
  // ...
}).catch((e) => console.error(e));

const bleClient = new GattClient(id, peripheral, pairingData);

bleClient.on('event', (ev) => {
  // ...
});

bleClient.subscribeCharacteristics(
  [
    {
      serviceUuid: '...',         // the "type" property
      characteristicUuid: '...',  // the "type" property
      iid: 10,
      format: 'bool',             // if known
    },
  ]
).then(() => {
  // ...
}).catch((e) => console.error(e));

bleClient.unsubscribeCharacteristics(
  [
    {
      serviceUuid: '...',         // the "type" property
      characteristicUuid: '...',  // the "type" property
    },
  ]
).then(() => {
  // ...
}).catch((e) => console.error(e));
```

## Examples

Examples of all of the APIs can be found in the [GitHub repo](https://github.com/mrstegeman/hap-controller-node/tree/master/examples).

## Contributing

Please feel free to open an [issue](https://github.com/mrstegeman/hap-controller-node/issues) or a [pull request](https://github.com/mrstegeman/hap-controller-node/pulls) if you find something that could use improvement.
