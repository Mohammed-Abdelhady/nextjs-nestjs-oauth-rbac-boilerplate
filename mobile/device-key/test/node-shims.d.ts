declare module 'node:crypto' {
  interface JsonWebKey {
    kty?: string;
    crv?: string;
    x?: string;
    y?: string;
    d?: string;
  }

  interface KeyObject {
    readonly type: string;
    export(options: { format: 'jwk' }): JsonWebKey;
    export(options: { type: 'spki'; format: 'der' }): Uint8Array;
  }

  interface Hash {
    update(data: string | Uint8Array): Hash;
    digest(): Uint8Array;
  }

  type SigningKey = KeyObject | { key: KeyObject; dsaEncoding: 'der' | 'ieee-p1363' };

  export type { JsonWebKey, KeyObject };
  export function createHash(algorithm: 'sha256'): Hash;
  export function createPrivateKey(options: { key: JsonWebKey; format: 'jwk' }): KeyObject;
  export function createPublicKey(key: KeyObject | { key: JsonWebKey; format: 'jwk' }): KeyObject;
  export function generateKeyPairSync(
    type: 'ec',
    options: { namedCurve: 'P-256' | 'secp384r1' },
  ): { privateKey: KeyObject; publicKey: KeyObject };
  export function sign(algorithm: 'sha256', data: Uint8Array, key: SigningKey): Uint8Array;
  export function verify(
    algorithm: 'sha256',
    data: Uint8Array,
    key: SigningKey,
    signature: Uint8Array,
  ): boolean;
}

declare module 'node:buffer' {
  type Encoding = 'utf8' | 'hex' | 'base64' | 'base64url';

  export class Buffer extends Uint8Array {
    static from(value: string, encoding?: Encoding): Buffer;
    static from(value: Uint8Array | readonly number[]): Buffer;
    static alloc(size: number, fill: number): Buffer;
    static concat(list: readonly Uint8Array[]): Buffer;
    toString(encoding?: Encoding): string;
  }
}
