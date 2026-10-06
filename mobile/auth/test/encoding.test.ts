import { describe, expect, it } from 'vitest';
import { base64UrlEncode, pkceChallenge } from '../src/encoding';
import { sha256 } from './sha256';

const BASE64_CASES = [
  ['', ''],
  ['f', 'Zg'],
  ['fo', 'Zm8'],
  ['foo', 'Zm9v'],
  ['foob', 'Zm9vYg'],
  ['fooba', 'Zm9vYmE'],
  ['foobar', 'Zm9vYmFy'],
] as const;

function asciiBytes(value: string): Uint8Array {
  return Uint8Array.from(value, (character) => character.charCodeAt(0));
}

describe('base64url encoding', () => {
  it.each(BASE64_CASES)('encodes %s per RFC 4648', (input, expected) => {
    expect(base64UrlEncode(asciiBytes(input))).toBe(expected);
  });

  it('masks signed octets and encodes alphabet index 63', () => {
    expect(base64UrlEncode(new Int8Array([-1]))).toBe('_w');
    expect(base64UrlEncode(Uint8Array.from([0, 0, 63]))).toBe('AAA_');
  });

  it('builds the RFC 7636 appendix B S256 challenge', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    const challenge = 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM';
    const verifierOctets = Uint8Array.from([
      100, 66, 106, 102, 116, 74, 101, 90, 52, 67, 86, 80, 45, 109, 66, 57, 50, 75, 50, 55, 117,
      104, 98, 85, 74, 85, 49, 112, 49, 114, 95, 119, 87, 49, 103, 70, 87, 70, 79, 69, 106, 88, 107,
    ]);

    await expect(
      pkceChallenge(verifier, {
        sha256: async (value) => {
          expect(value).toEqual(verifierOctets);
          return sha256(value);
        },
      }),
    ).resolves.toBe(challenge);
  });
});
