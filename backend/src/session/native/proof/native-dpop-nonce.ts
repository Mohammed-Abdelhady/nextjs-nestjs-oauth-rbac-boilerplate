import { createHmac } from 'node:crypto';
import {
  NATIVE_DPOP_NONCE_BUCKET_MS,
  NATIVE_DPOP_NONCE_DOMAIN,
} from '../../constants/session-policy';
import { secretEquals } from '../../utils/hashing/token-hash';

export function createNativeDpopNonce(secret: string, now: Date): string {
  return nonceForBucket(secret, bucketAt(now));
}

export function nativeDpopNonceCandidates(
  secret: string,
  now: Date,
): readonly string[] {
  const currentBucket = bucketAt(now);
  return [
    nonceForBucket(secret, currentBucket),
    nonceForBucket(secret, currentBucket - 1),
  ];
}

export function isNativeDpopNonceValid(
  secret: string,
  now: Date,
  presented: string,
): boolean {
  let valid = false;
  for (const expected of nativeDpopNonceCandidates(secret, now)) {
    valid = secretEquals(presented, expected) || valid;
  }
  return valid;
}

function bucketAt(now: Date): number {
  return Math.floor(now.getTime() / NATIVE_DPOP_NONCE_BUCKET_MS);
}

function nonceForBucket(secret: string, bucket: number): string {
  const digest = createHmac('sha256', secret)
    .update(`${NATIVE_DPOP_NONCE_DOMAIN}${bucket}`)
    .digest('base64url');
  return `${bucket}.${digest}`;
}
