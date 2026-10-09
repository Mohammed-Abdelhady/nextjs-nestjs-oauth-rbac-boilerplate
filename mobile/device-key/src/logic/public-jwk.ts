import type { Es256PublicJwk } from '@app/native-auth';
import {
  P256_COORDINATE_BYTES,
  P256_POINT_BYTES,
  P256_SPKI_PREFIX,
  UNCOMPRESSED_POINT_LEAD,
} from '../constants';
import { base64UrlEncode } from './base64';

/**
 * iOS exports the point itself. Android exports the certificate's key, which is
 * the same point behind a fixed header. Any other shape is `undefined`.
 */
export function uncompressedPoint(encoded: Uint8Array): Uint8Array | undefined {
  let point = encoded;
  if (encoded.length === P256_SPKI_PREFIX.length + P256_POINT_BYTES) {
    if (P256_SPKI_PREFIX.some((byte, index) => encoded[index] !== byte)) return undefined;
    point = encoded.subarray(P256_SPKI_PREFIX.length);
  }
  if (point.length !== P256_POINT_BYTES || point[0] !== UNCOMPRESSED_POINT_LEAD) return undefined;
  return point;
}

/** x and y are always 32 bytes, so each is always 43 characters. */
export function publicJwk(encoded: Uint8Array): Es256PublicJwk | undefined {
  const point = uncompressedPoint(encoded);
  if (point === undefined) return undefined;
  return {
    kty: 'EC',
    crv: 'P-256',
    x: base64UrlEncode(point.subarray(1, 1 + P256_COORDINATE_BYTES)),
    y: base64UrlEncode(point.subarray(1 + P256_COORDINATE_BYTES)),
    alg: 'ES256',
  };
}
