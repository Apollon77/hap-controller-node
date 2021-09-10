# hap-controller

[![npm](https://img.shields.io/npm/v/hap-controller.svg)](https://www.npmjs.com/package/hap-controller)
[![GitHub License](https://img.shields.io/github/license/Apollon77/hap-controller-node.svg)](LICENSE)

This library allows you to build a HomeKit controller, capable of discovering and controlling both Wi-Fi and BLE devices.

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

ipClient.on('event-disconnect', (subscribedList) => {
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

bleClient.on('event-disconnect', (subscribedList) => {
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

Examples of all of the APIs can be found in the [GitHub repo](https://github.com/Apollon77/hap-controller-node/tree/master/examples).

## Contributing

Please feel free to open an [issue](https://github.com/Apollon77/hap-controller-node/issues) or a [pull request](https://github.com/Apollon77/hap-controller-node/pulls) if you find something that could use improvement.

## Changelog

### __WORK IN PROGRESS__
* (Apollon77) Take over library (thanks to @mrstegeman for his great work so far and the ongoing consulting!)
* (Apollon77) Add automatic detection for PairMethod to use based on discovery details (HTTP) or via extra method to read data from device (BLE)
* (Apollon77) add getPairingMethod methods to the Client classes (as async for both because for BLE needs to be read from device while in Discovery response for IP devices, also adjust examples - so still not really "automatically resolved" but as method for the user to call and provide response to the pair method
* (Apollon77) add debug lib and communication and tlv parsing/building logging
* (Apollon77) add some convenient names to ble service definition to have same fields for "config version" ("c#") and "device id" ("id") for both service types
* (Apollon77) add availableForPairing to both service objects and adjust the examples
* (Apollon77) Adjust subscription handling for both transfers to keep the connection internally, so it is not returned anymore. Additionally the library keeps a list of all subscribed characteristics and will also check for duplicates
* (Apollon77) The "disconnect" event is renamed to "event-disconnect" because it only notifies for disconnection of event subscriptions and returns the former list of subscribed characteristics as array that can directly be used to resubscribe
* (Apollon77) Added "serviceChanged" events to both Discovery classes to be notified on changed advertisements - changed means that a relevant field of the service data has changed - mainly used to check GSN (for BLE) or "c#" (both)
* (Apollon77) Added a "disconnect" and "connect" events to GattConnection to match HttpConnection
* (Apollon77) Make sure getAccessories return UUIDs in all cases for HTTP and BLE
* (Apollon77) enhance the perms returned from GattClient and add ev-connected, ev-disconnected and ev-broadcast if supported
* (Apollon77) Define own Error class (HomekitControllerError) to transport enhanced info like statusCode and error body
* (Apollon77) Allow to set a also other properties for the characteristic on write (like authData, remote and r)
* (Apollon77) Update service and characteristic lists based on HapNodeJS because official specs are still from 2019
* (Apollon77) adjustments to logic that was not working for me (mostly BLE stuff like flagging primary/hidden service in the data))
* (Apollon77) smaller adjustments in docs and types

