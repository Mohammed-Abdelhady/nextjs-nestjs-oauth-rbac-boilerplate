import {
  DER_LONG_FORM,
  DER_SIGN_BIT,
  DER_SIGNATURE_MIN_BYTES,
  DER_TAG,
  P256_COORDINATE_BYTES,
  RAW_SIGNATURE_BYTES,
} from '../constants';

interface DerInteger {
  /** The magnitude without its sign padding. */
  value: Uint8Array;
  end: number;
}

function readInteger(der: Uint8Array, offset: number): DerInteger | undefined {
  if (der[offset] !== DER_TAG.INTEGER) return undefined;
  const length = der[offset + 1];
  if (length === undefined || length === 0 || length >= DER_LONG_FORM) return undefined;
  let start = offset + 2;
  const end = start + length;
  if (end > der.length) return undefined;
  const first = der[start] ?? 0;
  // A set top bit is a negative number, which r and s never are.
  if ((first & DER_SIGN_BIT) !== 0) return undefined;
  if (first === 0) {
    const next = der[start + 1];
    // A lone zero is the number zero, and a pad before a clear top bit is not DER.
    if (next === undefined || (next & DER_SIGN_BIT) === 0) return undefined;
    start += 1;
  }
  if (end - start > P256_COORDINATE_BYTES) return undefined;
  return { value: der.subarray(start, end), end };
}

/**
 * Both platforms return ECDSA signatures as a DER sequence of two integers.
 * JWS wants r and s as two 32-byte numbers, each left-padded with zeros.
 * A signature that is not exactly that sequence is `undefined`.
 */
export function derToRawSignature(der: Uint8Array): Uint8Array | undefined {
  if (der.length < DER_SIGNATURE_MIN_BYTES || der[0] !== DER_TAG.SEQUENCE) return undefined;
  const length = der[1];
  if (length === undefined || length >= DER_LONG_FORM || length !== der.length - 2) {
    return undefined;
  }
  const r = readInteger(der, 2);
  if (r === undefined) return undefined;
  const s = readInteger(der, r.end);
  if (s === undefined || s.end !== der.length) return undefined;
  const raw = new Uint8Array(RAW_SIGNATURE_BYTES);
  raw.set(r.value, P256_COORDINATE_BYTES - r.value.length);
  raw.set(s.value, RAW_SIGNATURE_BYTES - s.value.length);
  return raw;
}
