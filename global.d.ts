declare module 'http-parser-js' {
  function HTTPParser(type?: string): ParserState;
  namespace HTTPParser {
    const REQUEST: string;
    const RESPONSE: string;
  }

  interface ParserState {
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

  export { HTTPParser, ParserState };
}

declare module 'hkdf' {
  export default class HKDF {
    constructor(hashAlg: string, salt: Buffer | string, ikm: Buffer | string);
    derive(info: Buffer | string, size: number, cb: (key: Buffer) => void): void;
  }
}
