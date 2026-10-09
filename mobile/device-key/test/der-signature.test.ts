import { Buffer } from 'node:buffer';
import { createPrivateKey, createPublicKey, sign, verify } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { derToRawSignature } from '../src/logic/der-signature';
import { hex, KEY_JWK, SIGNATURE_VECTORS, SIGNED_MESSAGE, toHex } from './vectors';

const PRIVATE_KEY = createPrivateKey({ key: KEY_JWK, format: 'jwk' });
const PUBLIC_KEY = createPublicKey(PRIVATE_KEY);
const MESSAGE = Buffer.from(SIGNED_MESSAGE);

function nodeAccepts(raw: Uint8Array | undefined): boolean {
  if (raw === undefined) return false;
  return verify('sha256', MESSAGE, { key: PUBLIC_KEY, dsaEncoding: 'ieee-p1363' }, raw);
}

const ZEROS_31 = '00'.repeat(31);
const HALF_32 = '11'.repeat(32);

describe('DER signature to raw r and s', () => {
  it.each(SIGNATURE_VECTORS)('converts a signature where $shape', ({ der, raw }) => {
    const converted = derToRawSignature(hex(der));

    expect(toHex(converted)).toBe(raw);
    expect(nodeAccepts(converted)).toBe(true);
  });

  it('converts a signature Node has just made into one Node verifies', () => {
    const der = sign('sha256', MESSAGE, { key: PRIVATE_KEY, dsaEncoding: 'der' });

    const converted = derToRawSignature(new Uint8Array(der));

    expect(converted).toHaveLength(64);
    expect(nodeAccepts(converted)).toBe(true);
  });

  it('pads one-byte numbers to 32 bytes each', () => {
    expect(toHex(derToRawSignature(hex('3006020101020102')))).toBe(`${ZEROS_31}01${ZEROS_31}02`);
  });

  it('drops the sign byte and keeps a top bit that is part of the number', () => {
    expect(toHex(derToRawSignature(hex('300702017f02020080')))).toBe(`${ZEROS_31}7f${ZEROS_31}80`);
  });

  it.each([
    ['nothing', ''],
    ['fewer bytes than two integers need', '30050201010201'],
    ['a set instead of a sequence', '3106020101020102'],
    ['a long-form sequence length', '308106020101020102'],
    ['a sequence length shorter than the content', '3005020101020102'],
    ['a sequence length longer than the content', '3007020101020102'],
    ['a byte after the second integer', '300702010102010200'],
    ['a first element that is not an integer', '3006030101020102'],
    ['a second element that is not an integer', '3006020101030102'],
    ['an integer of no bytes', '3006020002020102'],
    ['an integer that runs past the end', '3006020101020502'],
    ['a negative r', '3006020180020102'],
    ['a negative s', '3006020101020180'],
    ['r equal to zero', '3006020100020102'],
    ['s equal to zero', '3006020101020100'],
    ['a sign byte before a clear top bit', '300702020001020102'],
    ['r one byte wider than the curve', `3026022101${HALF_32}020102`],
    ['a long-form integer length', '300702810101020102'],
  ])('refuses %s', (_name, der) => {
    expect(derToRawSignature(hex(der))).toBeUndefined();
  });
});
