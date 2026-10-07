import type { CryptoPort } from '@app/native-auth';
import { CRYPTO_FAILURE, SHA256_BYTES } from '../constants';
import type { CryptoApi } from '../types/modules';

export function createCryptoPort<TAlgorithm>(
  crypto: CryptoApi<TAlgorithm>,
  sha256Algorithm: TAlgorithm,
): CryptoPort {
  return {
    async randomBytes(length) {
      const bytes = await crypto.getRandomBytesAsync(length);
      if (!(bytes instanceof Uint8Array) || bytes.length !== length) {
        throw new Error(CRYPTO_FAILURE.RANDOM_LENGTH);
      }
      return bytes;
    },
    async sha256(bytes) {
      // A copy with its own buffer, so a view into a larger buffer is not hashed whole.
      const digest = new Uint8Array(await crypto.digest(sha256Algorithm, bytes.slice()));
      if (digest.length !== SHA256_BYTES) throw new Error(CRYPTO_FAILURE.DIGEST_LENGTH);
      return digest;
    },
  };
}
