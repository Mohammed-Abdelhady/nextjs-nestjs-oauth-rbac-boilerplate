import { Buffer } from 'node:buffer';
import { CANNED_COORDINATES_HEX, CANNED_SIGNATURE_HEX } from './support/canned-keys';

export const hex = (text: string): Uint8Array => new Uint8Array(Buffer.from(text, 'hex'));
export const toHex = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : Buffer.from(bytes).toString('hex');

/** A fixed P-256 key. `KEY_X_HEX` and `KEY_Y_HEX` are the same coordinates in hex. */
export const KEY_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: 'kEkTQfzZyf-oZboWzbjN20L1Dq7hNYukIyvH3msY394',
  y: 'Dhwd2dUIhY_-YTgJDQNh7VMP7CMF7LhiwZAwaFo17BM',
  d: 'AW6junCPJrbePntNSRe0OdJxPTDS2eFXNMEQ3pDVojk',
} as const;
export const { x: KEY_X_HEX, y: KEY_Y_HEX } = CANNED_COORDINATES_HEX[0];
export const KEY_SPKI_HEX =
  '3059301306072a8648ce3d020106082a8648ce3d030107034200' + '04' + KEY_X_HEX + KEY_Y_HEX;

/** A key whose x starts with a zero byte, the case a number-based export shortens. */
export const ZERO_LEAD_JWK = {
  kty: 'EC',
  crv: 'P-256',
  x: 'AAb1Jb_P1uSzDmM56F13Ul1k_f_7Bhcpt93lsdg_Kk0',
  y: 'KQXx6tiu3hV8HWduUvlWXb88sXQz5iVfmkt1ZH3MOjc',
  d: 'KIYbHvRAeEZ3-sD5VtnJXY_-Zsrx6EMa8-kK2VbA_HM',
} as const;
export const { x: ZERO_LEAD_X_HEX, y: ZERO_LEAD_Y_HEX } = CANNED_COORDINATES_HEX[1];

export const SIGNED_MESSAGE = 'device-key vector';

/**
 * Signatures `KEY_JWK` made over `SIGNED_MESSAGE`, one per shape DER can take.
 * `raw` is r then s, copied out of `der` by hand and padded to 32 bytes each.
 */
export const SIGNATURE_VECTORS = [
  {
    shape: 'both halves 32 bytes',
    der: CANNED_SIGNATURE_HEX,
    raw:
      '1d4bc20dfb56293843d1e16d08bc8030f86908ce5874f6bb8595ece67eb944ea' +
      '745e956a82c8c93b69793d4de0fb85838ff294f6dc797aeaaa4efa5691559a7c',
  },
  {
    shape: 'both halves carry a sign byte',
    der:
      '3046' +
      '022100' +
      '9902309eb14fd0bff260bbfe2da3ae7428b6801c7a1e4635dbd857f2cc6629e8' +
      '022100' +
      'd04784017b6e4723e840d87be3cc0a133af23a097586637b7d1c98948dd26d2e',
    raw:
      '9902309eb14fd0bff260bbfe2da3ae7428b6801c7a1e4635dbd857f2cc6629e8' +
      'd04784017b6e4723e840d87be3cc0a133af23a097586637b7d1c98948dd26d2e',
  },
  {
    shape: 'r is 31 bytes',
    der:
      '3044' +
      '021f' +
      '0e9894cb8573c081a183372b19a86d12f30c2a112b8f918b997f233ec90227' +
      '022100' +
      '9008ad30574f7770b7797511a66b9a9836402c537593fb470ab71a758f0d2ee7',
    raw:
      '000e9894cb8573c081a183372b19a86d12f30c2a112b8f918b997f233ec90227' +
      '9008ad30574f7770b7797511a66b9a9836402c537593fb470ab71a758f0d2ee7',
  },
  {
    shape: 's is 31 bytes',
    der:
      '3044' +
      '022100' +
      '961ff10f04e358a18ab9f74d46d0d8f1ed8fb8725e0f2f4abdae9dd7042dcecf' +
      '021f' +
      '2547ec879ad1f7cb58d97eac6632370d12d761e81ea761d46a0424a07f8a62',
    raw:
      '961ff10f04e358a18ab9f74d46d0d8f1ed8fb8725e0f2f4abdae9dd7042dcecf' +
      '002547ec879ad1f7cb58d97eac6632370d12d761e81ea761d46a0424a07f8a62',
  },
] as const;
