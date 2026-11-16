require('../lib/transport/ip/dnssd-readfqdn-fix');
const BufferWrapper = require('dnssd/lib/BufferWrapper');

describe('dnssd readFQDN fix', () => {
    it('does not loop on a self-referencing compression pointer', () => {
        expect(new BufferWrapper(Buffer.from([0xc0, 0x00])).readFQDN()).toBe('.');
    });

    it('still follows valid compression pointers', () => {
        // "a." at offset 0, then label "b" + pointer to offset 0 -> "b.a."
        const buf = Buffer.from([0x01, 0x61, 0x00, 0x01, 0x62, 0xc0, 0x00]);
        const w = new BufferWrapper(buf);
        expect(w.readFQDN()).toBe('a.');
        expect(w.readFQDN()).toBe('b.a.');
        expect(w.position).toBe(7);
    });
});
