import { TEST_NOW } from '../../../test/utils/frozen-clock';
import {
  createNativeDpopNonce,
  isNativeDpopNonceValid,
} from './native-dpop-nonce';

const NONCE_SECRET = 'native-dpop-test-secret-at-least-32-chars';
const CURRENT_NONCE = '67849200.D39EiUXtZzXo9pMNtusjSjClHXRY81m6xmkomp9li74';
const PREVIOUS_NONCE = '67849199.Ne0NwRUyXUmj54_D4fUuuqF5n1Bb28oUT1RzrXBCtjU';

describe('native DPoP nonce', () => {
  it('matches the independently calculated current bucket value', () => {
    expect(createNativeDpopNonce(NONCE_SECRET, TEST_NOW)).toBe(CURRENT_NONCE);
  });

  it('matches the previous bucket value and keeps it distinct from current', () => {
    const previousBucketTime = new Date(TEST_NOW.getTime() - 60_000);
    const previousNonce = createNativeDpopNonce(
      NONCE_SECRET,
      previousBucketTime,
    );

    expect(previousNonce).toBe(PREVIOUS_NONCE);
    expect(previousNonce).not.toBe(CURRENT_NONCE);
  });

  it('accepts only the current and previous bucket values', () => {
    const twoMinutesLater = new Date(TEST_NOW.getTime() + 120_000);
    const staleNonce = '67849200.D39EiUXtZzXo9pMNtusjSjClHXRY81m6xmkomp9li74';

    expect(isNativeDpopNonceValid(NONCE_SECRET, TEST_NOW, CURRENT_NONCE)).toBe(
      true,
    );
    expect(isNativeDpopNonceValid(NONCE_SECRET, TEST_NOW, PREVIOUS_NONCE)).toBe(
      true,
    );
    expect(
      isNativeDpopNonceValid(NONCE_SECRET, twoMinutesLater, staleNonce),
    ).toBe(false);
    expect(isNativeDpopNonceValid(NONCE_SECRET, TEST_NOW, 'forged')).toBe(
      false,
    );
    expect(isNativeDpopNonceValid(NONCE_SECRET, TEST_NOW, '')).toBe(false);
  });
});
