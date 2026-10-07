import { describe, expect, it } from 'vitest';
import { browserErrorToOutcome, browserResultToOutcome } from '../src/logic/browser-outcome';
import { storeConditionFromError } from '../src/logic/secure-store-errors';
import { FakeCodedError, keychainError } from './support/fake-store';

const ANDROID_DECRYPT =
  "Could not decrypt the value for key 'auth.x' under keychain 'key_v1'. Caused by: ";

describe('secure store error to credential outcome', () => {
  it.each([
    ['User interaction is not allowed.', 'locked'],
    ['User canceled the operation.', 'cancelled'],
    ['Unable to decode the provided data.', 'corrupt'],
    ['No keychain is available. You may need to restart your computer.', 'unavailable'],
    ['I/O error.', 'unavailable'],
    ['Authentication failed. Provided passphrase/PIN is incorrect.', 'unavailable'],
  ])('reads the iOS keychain reason "%s" as %s', (reason, expected) => {
    expect(storeConditionFromError(keychainError(reason, 'getValueWithKeyAsync'))).toBe(expected);
  });

  it.each([
    ['Could not parse the encrypted JSON item in SecureStore: Unterminated object', 'corrupt'],
    ['Could not find the encryption scheme used for key: auth.x', 'corrupt'],
    ['The item for key auth.x in SecureStore has an unknown encoding scheme rsa)', 'corrupt'],
    ['Keystore operation failed', 'unavailable'],
    ['unknown', 'unavailable'],
  ])('reads the Android decrypt cause "%s" as %s', (cause, expected) => {
    const error = new FakeCodedError('ERR_DECRYPT', ANDROID_DECRYPT + cause);

    expect(storeConditionFromError(error)).toBe(expected);
  });

  it.each([[undefined], [null], [42], [{ message: 'User interaction is not allowed.' }], ['']])(
    'reads a rejection that is not an error (%j) as unavailable',
    (rejection) => {
      expect(storeConditionFromError(rejection)).toBe('unavailable');
    },
  );

  it('reads a reason rejected as plain text', () => {
    expect(storeConditionFromError('User canceled the operation.')).toBe('cancelled');
  });
});

describe('browser session result to port outcome', () => {
  it('reports the return address of a finished session', () => {
    expect(browserResultToOutcome({ type: 'success', url: 'sampleapp://cb?code=1' })).toEqual({
      kind: 'redirect',
      url: 'sampleapp://cb?code=1',
    });
  });

  it.each([[undefined], ['']])('fails a finished session whose address is %j', (url) => {
    expect(browserResultToOutcome({ type: 'success', url })).toEqual({
      kind: 'failed',
      reason: 'redirectWithoutAddress',
    });
  });

  it.each([
    ['cancel', { kind: 'cancelled' }],
    ['dismiss', { kind: 'dismissed' }],
    ['locked', { kind: 'failed', reason: 'browserLocked' }],
    ['opened', { kind: 'failed', reason: 'unexpectedResult:opened' }],
  ])('maps the module result "%s"', (type, expected) => {
    expect(browserResultToOutcome({ type })).toEqual(expected);
  });

  it('names a rejection by its Expo error code', () => {
    const error = new FakeCodedError('ERR_WEB_BROWSER_ALREADY_OPEN', 'Another web browser is open');

    expect(browserErrorToOutcome(error)).toEqual({
      kind: 'failed',
      reason: 'ERR_WEB_BROWSER_ALREADY_OPEN',
    });
  });

  it('falls back to the message, then to a fixed reason', () => {
    expect(browserErrorToOutcome(new Error('No activity to present from'))).toEqual({
      kind: 'failed',
      reason: 'No activity to present from',
    });
    expect(browserErrorToOutcome(new Error(''))).toEqual({ kind: 'failed', reason: 'unknown' });
    expect(browserErrorToOutcome(undefined)).toEqual({ kind: 'failed', reason: 'unknown' });
    expect(browserErrorToOutcome({ code: '' })).toEqual({ kind: 'failed', reason: 'unknown' });
  });
});
