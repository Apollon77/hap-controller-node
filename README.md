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

### General notes about "concurrent requests"

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

## Troubleshooting

### Known incompatible devices
If you have issues pairing the device with this adapter please try to pair it with the normal iOS Apple Home App. If this do not work then something is weird with the device and then also this adapter can not help. Pot try a reset, but else there is not chance.

This is currently that way for some Tado Door Locks as example. They need to be paired using the Tado App which is somehow registering the device into Apple Home, but not via an official pair process.

Additional also Nuki 3 Locks (BLE) are not possible to pair because they use Hardware Authentication components that are not publicly documented by Apple.

For Netatmo a user found out how pairing could be possible when it had issue. See https://github.com/Apollon77/ioBroker.homekit-controller/issues/233#issuecomment-1311983379

### For BLE issues
* If you have issues that the BLE connection do not work our you get Errors when the adapter tries to initialize the BluetoothLE connection, please first check and follow https://github.com/noble/noble#running-on-linux
* Does the device have a Pairing Mode or such that needs to be activated first? But also read the manual careful, maybe the Pairing mode is for some other legacy protocol or bridge but not Apple Home.
* Please make sure that your system is up-to-date including kernel `apt update && apt dist-upgrade`
* Try to reset the relevant BLE device with e.g. `sudo hciconfig hci0 reset`
* For issues also provide the output of `uname -a` and `lsusb`
* Low level BLE device log can be obtained using `sudo hcidump -t -x >log.txt` (in a second shell additionally to run the script)

### General advices
* Basically if the error "pair-setup characteristic not found" pops up while trying to pair then the device do not support pairing via Homekit in it's current state. The adapter cn not do anything then!
* Please make sure to enter the PIN mit Dashes in the form "XXX-XX-XXX". Other formats should be declined by the library already by an error, but just to make sure

## Debugging
When you have issues and want to report an Issue (see below) then enhanced debug log is always helpful.

Please start your application using 

`DEBUG=hap* node myprocess.js`

and post the console log also in the issue. This will generate a log on protocol level.

## Contributing

Please feel free to open an [issue](https://github.com/Apollon77/hap-controller-node/issues) or a [pull request](https://github.com/Apollon77/hap-controller-node/pulls) if you find something that could use improvement.
For Issues please consider to directly provide debug loggins (see above). 

## Changelog
### 0.10.1 (2023-11-23)
* (Apollon77) Remove duplicate entries in characteristic list

### 0.10.0 (2023-09-23)
* (Apollon77) Also return all found addresses and not just the first one
* (Apollon77) Update dependencies

### 0.9.3 (2023-02-27)
* (Apollon77) Update Noble to fix CPU/Memory issue

### 0.9.2 (2023-01-10)
* (Apollon77) Adjust some more places to finalize BigInt support

### 0.9.1 (2023-01-10)
* (Apollon77) Return response body for getCharacteristics and subscribe/unsubscribe also when return code was 207 in IP mode

### 0.9.0 (2023-01-09)
* (Apollon77) BREAKING: Returned data objects partially contain BigInt values (represented by bignumber.js instances) for iid/aid fields!

### 0.8.4 (2023-01-05)
* (Apollon77) Upgrade noble

### 0.8.3 (2022-12-31)
* (Apollon77) Downgrade noble again

### 0.8.2 (2022-12-22)
* (Apollon77) Upgrade noble package

### 0.8.1 (2022-06-10)
* (Apollon77) Make HTTP Client options optional

### 0.8.0 (2022-06-10)
* (Apollon77) Initialize transaction ID randomly for BLE
* (Apollon77) Add experimental flag options.subscriptionsUseSameConnection for HTTP Client to use the same connection for subscriptions and for all other calls to only have one connection from controller to the device.

### 0.7.4 (2022-05-06)
* (Apollon77) Add Host header to all HTTP calls because some devices seem to require it
* (Apollon77) Check that client was initialized before accessing the connected state

### 0.7.2 (2022-01-25)
* (Apollon77) Add method "closePersistentConnection" to HTTPClient to allow a close of this connection (e.g. when commands get timeouts or such)

### 0.7.0 (2022-01-21)
* (Apollon77) Introduce `close` method to tear down all connections that are potentially open
* (Apollon77) Use a persistent connection by default to prevent the need to verify the pairing for each call. Can be disabled using a new `options` parameter in constructor. You must call `close()` if you do not need the instance any longer
* (Apollon77) Make sure calls on a http connection are queued to not overlap
* (Apollon77) check ble status before start a new scanning process
* (Apollon77) remember that scanning was stopped when stop() is called
* (Apollon77) Fix pot. hanging response if multiple subscriptions are done on same device
* (Apollon77) Deprecate "GattConnection.iPeripheralConnected" in favor of a unified "isConnected" for BLE and HTTP connections
* (Apollon77) Prevent parallel pair verify calls by queuing them
* (Apollon77) Convert all examples to async/await for better readability and add close calls

### 0.6.1 (2021-10-18)
* (Apollon77) move error class in own file and adjust some typings

### 0.6.0 (2021-10-17)
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
* (Apollon77) Allow also other properties to be set for the characteristic on write (like authData, remote and r)
* (Apollon77) Update service and characteristic lists based on HapNodeJS because official specs are still from 2019
* (Apollon77) adjustments to logic that was not working for me (mostly BLE things like flagging primary/hidden service in the data))
* (Apollon77) smaller adjustments and restructuring of docs and type definitions

### till 0.5.0 (16.08.2021)
Former versions published by @mrstegeman
