import { Buffer } from 'node:buffer';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from 'node:crypto';
import type { JsonWebKey, KeyObject } from 'node:crypto';
import type { Es256PublicJwk } from '@app/native-auth';
import type { FakeKey, FakeKeySource } from './support';
import { KEY_JWK } from './vectors';

export type Platform = 'ios' | 'android';

/** A fake key backed by a real one. `jwk` is what Node says its public half is. */
export interface NodeKey extends FakeKey {
  jwk: Es256PublicJwk;
}

function nodeKey(privateKey: KeyObject, platform: Platform): NodeKey {
  const publicKey = createPublicKey(privateKey);
  const { x = '', y = '' } = publicKey.export({ format: 'jwk' });
  return {
    jwk: { kty: 'EC', crv: 'P-256', x, y, alg: 'ES256' },
    publicKey:
      platform === 'ios'
        ? Buffer.concat([
            Buffer.from([0x04]),
            Buffer.from(x, 'base64url'),
            Buffer.from(y, 'base64url'),
          ])
        : publicKey.export({ type: 'spki', format: 'der' }),
    sign: (data) => sign('sha256', data, { key: privateKey, dsaEncoding: 'der' }),
  };
}

/** New random keys, exported the way the platform exports them. */
export function nodeKeySource(platform: Platform): FakeKeySource<NodeKey> {
  return {
    create: () => nodeKey(generateKeyPairSync('ec', { namedCurve: 'P-256' }).privateKey, platform),
  };
}

/** The fixed key from the vectors, as a key an earlier app start left behind. */
export function fixedKey(platform: Platform, privateJwk: JsonWebKey = KEY_JWK): NodeKey {
  return nodeKey(createPrivateKey({ key: privateJwk, format: 'jwk' }), platform);
}
