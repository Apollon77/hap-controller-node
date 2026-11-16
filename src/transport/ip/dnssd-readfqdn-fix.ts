/**
 * Runtime fix for dnssd 0.4.1 (unmaintained): BufferWrapper.readFQDN follows DNS
 * compression pointers without a cycle guard. A self-referencing or cyclic pointer
 * in an incoming mDNS packet makes it loop forever at 100% CPU and blocks the
 * event loop. This replaces readFQDN with the same logic plus a visited-pointer
 * set and the RFC 1035 label limit (127).
 */

/* eslint-disable @typescript-eslint/no-var-requires */
const BufferWrapper = require('dnssd/lib/BufferWrapper');

BufferWrapper.prototype.readFQDN = function readFQDN(): string {
    const labels: string[] = [];
    const seenPointers = new Set<number>();
    let len: number;
    let farthest: number | undefined;

    while (this.remaining() >= 0 && (len = this.readUInt8())) {
        if (len < 192) {
            labels.push(this.readString(len));
            if (labels.length > 127) {
                break;
            }
        } else {
            const position = (len << 8) + this.readUInt8() - 0xc000;
            if (!farthest) {
                farthest = this.position;
            }
            if (seenPointers.has(position)) {
                break;
            }
            seenPointers.add(position);
            this.seek(position);
        }
    }

    if (farthest) {
        this.seek(farthest);
    }

    return `${labels.join('.')}.`;
};

export {};
