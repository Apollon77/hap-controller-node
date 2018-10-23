'use strict';

/* eslint-disable max-len */

/**
 * See Table 6-7
 */
const Opcodes = {
  'HAP-Characteristic-Signature-Read': 1,
  'HAP-Characteristic-Write': 2,
  'HAP-Characteristic-Read': 3,
  'HAP-Characteristic-Timed-Write': 4,
  'HAP-Characteristic-Execute-Write': 5,
  'HAP-Service-Signature-Read': 6,
};

/**
 * See Table 6-9
 */
const Types = {
  'HAP-Param-Value': 1,
  'HAP-Param-Additional-Authorization-Data': 2,
  'HAP-Param-Origin (local vs remote)': 3,
  'HAP-Param-Characteristic-Type': 4,
  'HAP-Param-Characteristic-Instance-ID': 5,
  'HAP-Param-Service-Type': 6,
  'HAP-Param-Service-Instance-ID': 7,
  'HAP-Param-TTL': 8,
  'HAP-Param-Return-Response': 9,
  'HAP-Param-HAP-Characteristic-Properties-Descriptor': 10,
  'HAP-Param-GATT-User-Description-Descriptor': 11,
  'HAP-Param-GATT-Presentation-Format-Descriptor': 12,
  'HAP-Param-GATT-Valid-Range': 13,
  'HAP-Param-HAP-Step-Value-Descriptor': 14,
  'HAP-Param-HAP-Service-Properties': 15,
  'HAP-Param-HAP-Linked-Services': 16,
  'HAP-Param-HAP-Valid-Values-Descriptor': 17,
  'HAP-Param-HAP-Valid-Values-Range-Descriptor': 18,
};

/**
 * See Table 6-26
 */
const StatusCodes = {
  0: {
    definition: 'Success',
    description: 'The request was successful.',
  },
  1: {
    definition: 'Unsupported-PDU',
    description: 'The request failed as the HAP PDU was not recognized or supported.',
  },
  2: {
    definition: 'Max-Procedures',
    description: 'The request failed as the accessory has reached the the limit on the simultaneous procedures it can handle.',
  },
  3: {
    definition: 'Insufficient Authorization',
    description: 'Characteristic requires additional authorization data.',
  },
  4: {
    definition: 'Invalid Instance ID',
    description: 'The HAP Request\'s characteristic Instance id did not match the addressed characteristic\'s instance id.',
  },
  5: {
    definition: 'Insufficient Authentication',
    description: 'Characteristic access required a secure session to be established.',
  },
  6: {
    definition: 'Invalid Request',
    description: 'Accessory was not able to perform the requested operation.',
  },
};

/**
 * See Table 6-34
 */
const ServiceProperties = {
  1: 'Primary Service',
  2: 'Hidden Service',
};

/**
 * See Table 6-35
 */
const CharacteristicDescriptions = {
  1: 'Characteristic Supports Read',
  2: 'Characteristic Supports Write',
  4: 'Characteristic Supports Additional Authorization Data',
  8: 'Characteristic Requires HAP Characteristic Timed Write Procedure',
  16: 'Characteristics Supports Secure Reads',
  32: 'Characteristics Supports Secure Writes',
  64: 'Characteristic Hidden from User',
  128: 'Characteristic Notifies Events in Connected State',
  256: 'Characteristic Notifies Events in Disconnected State',
};

/**
 * See Table 6-36
 */
const BTSigToHapFormat = {
  1: 'bool',
  4: 'uint8',
  6: 'uint16',
  8: 'uint32',
  10: 'uint64',
  16: 'int',
  20: 'float',
  25: 'string',
  27: 'data',
};

/**
 * See Table 6-37
 */
const BTSigToHapUnit = {
  9984: 'unitless',
  9987: 'seconds',
  10031: 'celsius',
  10033: 'lux',
  10083: 'arcdegrees',
  10157: 'percentage',
};

/**
 * See Chapter 6.4.4.3
 */
const ServiceInstanceIdUuid = 'E604E95D-A759-4817-87D3-AA005083A0D1';

/**
 * See Chapter 6.4.4.5.2
 */
const CharacteristicInstanceIdUuid = 'DC46F0FE-81D2-4616-B5D9-6ABDD796939A';
const CharacteristicInstanceIdShortUuid = '939A';

/**
 * See Chapter 6.4.4.5.4
 */
const ServiceSignatureUuid = '000000A5-0000-1000-8000-0026BB765291';

module.exports = {
  BTSigToHapFormat,
  BTSigToHapUnit,
  CharacteristicDescriptions,
  CharacteristicInstanceIdUuid,
  CharacteristicInstanceIdShortUuid,
  Opcodes,
  ServiceInstanceIdUuid,
  ServiceProperties,
  ServiceSignatureUuid,
  StatusCodes,
  Types,
};
