/**
 * Test HTTP event parser.
 */

'use strict';

const e2p = require('event-to-promise');
const HttpEventParser = require('../lib/transport/ip/http-event-parser').default;

it('EVENT from spec', async () => {
    const message =
        'EVENT/1.0 200 OK\r\n' +
        'Content-Type: application/hap+json\r\n' +
        'Content-Length: 128\r\n' +
        '\r\n' +
        '{\n' +
        '    "characteristics" : [\n' +
        '        {\n' +
        '            "aid" : 1,\n' +
        '            "iid" : 4,\n' +
        '            "value" : 23.0\n' +
        '        }\n' +
        '    ]\n' +
        '}';

    const parser = new HttpEventParser();
    const eventPromise = e2p(parser, 'event');
    parser.execute(Buffer.from(message));

    let event = await Promise.race([eventPromise, new Promise((resolve, reject) => setTimeout(reject, 2000))]);

    expect(typeof event).toBe('object');

    event = JSON.parse(event.toString());

    expect(typeof event).toBe('object');
    expect(event.characteristics.length).toBe(1);
    expect(event.characteristics[0].aid).toBe(1);
    expect(event.characteristics[0].iid).toBe(4);
    expect(event.characteristics[0].value).toBeCloseTo(23.0);
});

it('EVENT from spec, with missing Content-Length header', async () => {
    const message =
        'EVENT/1.0 200 OK\r\n' +
        'Content-Type: application/hap+json\r\n' +
        '\r\n' +
        '{\n' +
        '    "characteristics" : [\n' +
        '        {\n' +
        '            "aid" : 1,\n' +
        '            "iid" : 4,\n' +
        '            "value" : 23.0\n' +
        '        }\n' +
        '    ]\n' +
        '}';

    const parser = new HttpEventParser();
    const eventPromise = e2p(parser, 'event');
    parser.execute(Buffer.from(message));

    let event = await Promise.race([eventPromise, new Promise((resolve, reject) => setTimeout(reject, 2000))]);

    expect(typeof event).toBe('object');

    event = JSON.parse(event.toString());

    expect(typeof event).toBe('object');
    expect(event.characteristics.length).toBe(1);
    expect(event.characteristics[0].aid).toBe(1);
    expect(event.characteristics[0].iid).toBe(4);
    expect(event.characteristics[0].value).toBeCloseTo(23.0);
});
