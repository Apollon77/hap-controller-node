/**
 * Constants used for HTTP procedures.
 */
/* eslint-disable max-len */
'use strict';

/**
 * See Table 5-12
 */
const StatusCodes = {
  0: 'This specifies a success for the request.',
  [-70401]: 'Request denied due to insufficient privileges.',
  [-70402]: 'Unable to communicate with requested service, e.g. the power to the accessory was turned off.',
  [-70403]: 'Resource is busy, try again.',
  [-70404]: 'Cannot write to read only characteristic.',
  [-70405]: 'Cannot read from a write only characteristic.',
  [-70406]: 'Notification is not supported for characteristic.',
  [-70407]: 'Out of resources to process request.',
  [-70408]: 'Operation timed out.',
  [-70409]: 'Resource does not exist.',
  [-70410]: 'Accessory received an invalid value in a write request.',
  [-70411]: 'Insufficient Authorization.',
};

module.exports = {
  StatusCodes,
};
