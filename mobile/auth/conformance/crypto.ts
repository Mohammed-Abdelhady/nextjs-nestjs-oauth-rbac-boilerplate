import { base64UrlEncode, utf8Bytes } from '../src/encoding';
import {
  BINARY_VECTOR,
  CHECK_ID,
  EMPTY_DIGEST,
  PKCE_VECTOR,
  RANDOM_LENGTHS,
  SHA256_LENGTH,
} from './constants';
import { attempt, describeValue, expectBytes, expectEqual, expectTrue } from './expect';
import type { ConformanceCheck, ConformanceSubject } from './types';

const digest = ({ adapters }: ConformanceSubject, bytes: Uint8Array) =>
  attempt('crypto.sha256()', () => adapters.crypto.sha256(bytes));

const random = ({ adapters }: ConformanceSubject, length: number) =>
  attempt('crypto.randomBytes()', () => adapters.crypto.randomBytes(length));

export const CRYPTO_CHECKS: readonly ConformanceCheck[] = [
  {
    id: CHECK_ID.CRYPTO_PKCE_VECTOR,
    port: 'crypto',
    async run(subject) {
      const result = await digest(subject, utf8Bytes(PKCE_VECTOR.VERIFIER));
      expectEqual(base64UrlEncode(result), PKCE_VECTOR.CHALLENGE, 'RFC 7636 challenge');
    },
  },
  {
    id: CHECK_ID.CRYPTO_SHA256_BYTES,
    port: 'crypto',
    async run(subject) {
      const input = Uint8Array.from(BINARY_VECTOR.INPUT);
      const result = await digest(subject, input);
      expectBytes(result, BINARY_VECTOR.DIGEST, 'digest of bytes that are not text');
      expectBytes(input, BINARY_VECTOR.INPUT, 'input after hashing');
      expectBytes(await digest(subject, new Uint8Array(0)), EMPTY_DIGEST, 'digest of no bytes');
    },
  },
  {
    id: CHECK_ID.CRYPTO_RANDOM_BYTES,
    port: 'crypto',
    async run(subject) {
      for (const length of RANDOM_LENGTHS) {
        const bytes = await random(subject, length);
        expectTrue(
          bytes instanceof Uint8Array && bytes.length === length,
          `randomBytes(${length}) must return ${length} bytes, got ${describeValue(bytes)}`,
        );
      }
      const first = await random(subject, SHA256_LENGTH);
      const second = await random(subject, SHA256_LENGTH);
      expectTrue(
        describeValue(first) !== describeValue(second),
        'two random draws returned the same bytes',
      );
    },
  },
];
