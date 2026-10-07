import { createPrivateKey, sign } from 'node:crypto';
import type { DeviceKeyPort, DeviceKeyResult, Es256PublicJwk } from '../src';

export const FIXED_PUBLIC_JWK: Es256PublicJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394',
  y: 'Dhwd2dUIhY_-YTgJDQNh7VMP7CMF7LhiwZAwaFo17BM',
  alg: 'ES256',
};

const FIXED_PRIVATE_JWK = {
  ...FIXED_PUBLIC_JWK,
  d: 'AW6junCPJrbePntNSRe0OdJxPTDS2eFXNMEQ3pDVojk',
  key_ops: ['sign'],
  ext: true,
};

export class SoftwareDeviceKey implements DeviceKeyPort {
  readonly publicKeyCalls: number[] = [];
  readonly signed: Uint8Array[] = [];
  readonly publicKeyResults: DeviceKeyResult<Es256PublicJwk>[] = [];
  publicKeyResult: DeviceKeyResult<Es256PublicJwk> | undefined;
  signatureOverride: Uint8Array | undefined;
  signResult: DeviceKeyResult<Uint8Array> | undefined;

  async publicKey() {
    this.publicKeyCalls.push(1);
    return (
      this.publicKeyResults.shift() ??
      this.publicKeyResult ?? { kind: 'success' as const, value: FIXED_PUBLIC_JWK }
    );
  }

  async sign(data: Uint8Array) {
    this.signed.push(data.slice());
    if (this.signResult) return this.signResult;
    if (this.signatureOverride) return { kind: 'success' as const, value: this.signatureOverride };
    const key = createPrivateKey({ key: FIXED_PRIVATE_JWK, format: 'jwk' });
    return {
      kind: 'success' as const,
      value: new Uint8Array(sign('sha256', data, { key, dsaEncoding: 'ieee-p1363' })),
    };
  }
}
