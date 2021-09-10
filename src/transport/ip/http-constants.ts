/**
 * Constants used for HTTP procedures.
 */

/**
 * See Table 5-12
 */
/* eslint-disable max-len */
export const HapStatusCodes = {
    0: 'This specifies a success for the request.',
    '-70401': 'Request denied due to insufficient privileges.',
    '-70402': 'Unable to communicate with requested service, e.g. the power to the accessory was turned off.',
    '-70403': 'Resource is busy, try again.',
    '-70404': 'Cannot write to read only characteristic.',
    '-70405': 'Cannot read from a write only characteristic.',
    '-70406': 'Notification is not supported for characteristic.',
    '-70407': 'Out of resources to process request.',
    '-70408': 'Operation timed out.',
    '-70409': 'Resource does not exist.',
    '-70410': 'Accessory received an invalid value in a write request.',
    '-70411': 'Insufficient Authorization.',
};

export const HttpStatusCodes = {
    200: 'OK. This specifies a success for the request.',
    207: 'Multi-Status. Request was not processed completely, e.g. only some of the provided characteristics could be written.',
    400: 'Bad Request. Generic error for a problem with the request, e.g. bad TLV, state error, etc.',
    404: 'Not Found. The requested URL was not found',
    405: 'Method Not Allowed. Wrong HTTP request method, e.g. GET when expecting POST.',
    422: 'Unprocessable Entity. for a well-formed request that contains invalid HTTP parameters.',
    429: 'Too Many Requests. Server cannot handle any more requests of this type, e.g. attempt to pair while already pairing.',
    470: 'Connection Authorization Required. Request to secure resource made without establishing security, e.g. didnʼt perform the Pair Verify procedure.',
    500: 'Internal Server Error. Server had a problem, e.g. ran out of memory.',
    503: 'Service Unavailable. If the accessory server is too busy to service the request, e.g. reached its maximum number of connections.',
};
/* eslint-enable max-len */
