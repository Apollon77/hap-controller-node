declare module 'http-parser-js' {
  export class HTTPParser {
    static REQUEST: string;

    static RESPONSE: string;

    constructor(type?: string);

    info: {
      headers: string[];
      upgrade: boolean;
      statusCode?: number;
    };

    execute: (chunk: Buffer, start?: number, length?: number) => number;

    onHeadersComplete: (info: {
      versionMajor: string;
      versionMinor: string;
      headers: string[];
      method: string | null;
      url: string | null;
      statusCode: number | null;
      statusMessage: string | null;
      upgrade: boolean;
      shouldKeepAlive: boolean;
    }) => void;

    onMessageComplete: () => void;

    onBody: (data: Buffer, offset: number, length: number) => void;
  }
}

declare module 'node-hkdf-sync' {
  export default class HKDF {
    constructor(hashAlg: string, salt: Buffer | string, ikm: Buffer | string);
    derive(info: Buffer | string, size: number): Buffer;
  }
}
