import { Buffer } from 'node:buffer';
import { createPrivateKey, createPublicKey, generateKeyPairSync, sign, verify } from 'node:crypto';
import type { JsonWebKey } from 'node:crypto';
import type { Es256PublicJwk } from '@app/native-auth';
import { describe, expect, it } from 'vitest';
import { publicJwk } from '../src/logic/public-jwk';
import {
  hex,
  KEY_JWK,
  KEY_SPKI_HEX,
  KEY_X_HEX,
  KEY_Y_HEX,
  ZERO_LEAD_JWK,
  ZERO_LEAD_X_HEX,
  ZERO_LEAD_Y_HEX,
} from './vectors';

const MESSAGE = Buffer.from('point to jwk');
const EXPECTED_JWK: Es256PublicJwk = {
  kty: 'EC',
  crv: 'P-256',
  x: 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394',
  y: 'Dhwd2dUIhY_-YTgJDQNh7VMP7CMF7LhiwZAwaFo17BM',
  alg: 'ES256',
};

/** Node builds a key from the JWK and checks a signature the private key made. */
function nodeVerifiesWith(jwk: Es256PublicJwk | undefined, privateJwk: JsonWebKey): boolean {
  if (jwk === undefined) return false;
  const signature = sign('sha256', MESSAGE, createPrivateKey({ key: privateJwk, format: 'jwk' }));
  return verify('sha256', MESSAGE, createPublicKey({ key: jwk, format: 'jwk' }), signature);
}

describe('public key to JWK', () => {
  it('reads the point iOS exports', () => {
    const jwk = publicJwk(hex(`04${KEY_X_HEX}${KEY_Y_HEX}`));

    expect(jwk).toEqual(EXPECTED_JWK);
    expect(nodeVerifiesWith(jwk, KEY_JWK)).toBe(true);
  });

  it('reads the certificate key Android exports', () => {
    const spki = createPublicKey(createPrivateKey({ key: KEY_JWK, format: 'jwk' })).export({
      type: 'spki',
      format: 'der',
    });
    expect(Buffer.from(spki).toString('hex')).toBe(KEY_SPKI_HEX);

    const jwk = publicJwk(new Uint8Array(spki));

    expect(jwk).toEqual(EXPECTED_JWK);
    expect(nodeVerifiesWith(jwk, KEY_JWK)).toBe(true);
  });

  it('keeps a coordinate that starts with a zero byte at full width', () => {
    const jwk = publicJwk(hex(`04${ZERO_LEAD_X_HEX}${ZERO_LEAD_Y_HEX}`));

    expect(jwk).toEqual({
      kty: 'EC',
      crv: 'P-256',
      x: 'AAb1Jb_P1uSzDmM56F13Ul1k_f_7Bhcpt93lsdg_Kk0',
      y: 'KQXx6tiu3hV8HWduUvlWXb88sXQz5iVfmkt1ZH3MOjc',
      alg: 'ES256',
    });
    expect(nodeVerifiesWith(jwk, ZERO_LEAD_JWK)).toBe(true);
  });

  it('refuses the certificate key of another curve', () => {
    const other = generateKeyPairSync('ec', { namedCurve: 'secp384r1' }).publicKey.export({
      type: 'spki',
      format: 'der',
    });

    expect(publicJwk(new Uint8Array(other))).toBeUndefined();
  });

  it.each([
    ['nothing', ''],
    ['a point one byte short', `04${KEY_X_HEX}${KEY_Y_HEX}`.slice(0, -2)],
    ['a point one byte long', `04${KEY_X_HEX}${KEY_Y_HEX}00`],
    ['a compressed point', `02${KEY_X_HEX}`],
    ['65 bytes that do not start as an uncompressed point', `03${KEY_X_HEX}${KEY_Y_HEX}`],
    // The curve identifier's last byte changed from 07 to 08.
    ['a header that names another curve', KEY_SPKI_HEX.replace('3d030107', '3d030108')],
    [
      'a certificate key whose point is not uncompressed',
      KEY_SPKI_HEX.replace('034200' + '04', '034200' + '03'),
    ],
  ])('refuses %s', (_name, encoded) => {
    expect(publicJwk(hex(encoded))).toBeUndefined();
  });
});
