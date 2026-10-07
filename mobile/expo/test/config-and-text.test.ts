import { AuthPortError, CredentialStoreError } from '@app/native-auth';
import { ApiError, OAuthError, TransportError } from '@app/sdk';
import { describe, expect, it } from 'vitest';
import {
  DIRECTION,
  MESSAGES,
  resolveLocale,
  translate,
  type MessageKey,
} from '../src/i18n/messages';
import { describeError, describeOutcome } from '../src/logic/outcome-text';
import { resolveConfig } from '../src/logic/resolve-config';

const PROFILE = {
  id: 'user-1',
  email: 'person@example.test',
  name: 'Test Person',
  role: 'user',
  permissions: [],
  authProvider: 'password',
  isVerified: true,
  twoFactorEnabled: false,
  passkeyCount: 0,
  linkedProviders: [],
};

describe('app configuration', () => {
  it('points a development build at the local server when no origin is set', () => {
    expect(resolveConfig({ apiOrigin: undefined, development: true })).toEqual({
      serverBaseAddress: 'http://localhost:5001',
      environment: 'development',
      clientId: 'com.example.mobile',
      redirectUri: 'com.example.mobile://oauth/callback',
      scopes: ['api'],
    });
  });

  it.each([[''], ['   ']])('treats the origin %j as not set', (apiOrigin) => {
    expect(resolveConfig({ apiOrigin, development: true }).serverBaseAddress).toBe(
      'http://localhost:5001',
    );
  });

  it('uses the configured origin, trimmed', () => {
    const config = resolveConfig({ apiOrigin: ' https://api.example.test ', development: false });

    expect(config.serverBaseAddress).toBe('https://api.example.test');
    expect(config.environment).toBe('production');
  });

  it('refuses to start a release build with no origin', () => {
    expect(() => resolveConfig({ apiOrigin: undefined, development: false })).toThrow(
      'EXPO_PUBLIC_API_ORIGIN is not set.',
    );
  });
});

describe('outcome as text', () => {
  it.each([
    [{ kind: 'restored', status: 'signedIn' } as const, 'restored (signedIn)'],
    [{ kind: 'storageBlocked', reason: 'locked' } as const, 'storageBlocked (locked)'],
    [{ kind: 'signedIn', profile: PROFILE } as const, 'signedIn'],
    [{ kind: 'cancelled' } as const, 'cancelled'],
    [{ kind: 'disposed' } as const, 'disposed'],
    [
      { kind: 'browserFailure', reason: 'browserLocked' } as const,
      'browserFailure (browserLocked)',
    ],
    [
      { kind: 'invalidCallback', reason: 'stateMismatch' } as const,
      'invalidCallback (stateMismatch)',
    ],
    [
      { kind: 'authorizationDenied', error: 'access_denied' } as const,
      'authorizationDenied (access_denied)',
    ],
    [{ kind: 'signedOut', revocation: 'revoked' } as const, 'signedOut (revoked)'],
    [{ kind: 'refreshed' } as const, 'refreshed'],
    [{ kind: 'notSignedIn' } as const, 'notSignedIn'],
  ])('describes %j', (outcome, expected) => {
    expect(describeOutcome(outcome)).toBe(expected);
  });

  it('names the error an outcome carries', () => {
    const oauth = new OAuthError({ status: 400, error: 'invalid_grant' });

    expect(describeOutcome({ kind: 'oauthFailure', error: oauth })).toBe(
      'oauthFailure (OAuthError 400 invalid_grant)',
    );
    expect(
      describeOutcome({ kind: 'signedOut', revocation: 'failed', error: new TransportError() }),
    ).toBe('signedOut (failed, TransportError no_response)');
  });

  it('says why the store refused a write, so a locked device reads as locked', () => {
    const locked = new CredentialStoreError('credentials.replace', 'locked');

    expect(describeError(locked)).toBe('CredentialStoreError credentials.replace locked');
    expect(describeOutcome({ kind: 'failed', error: locked })).toBe(
      'failed (CredentialStoreError credentials.replace locked)',
    );
  });

  it('describes each error a request can reject with', () => {
    const api = new ApiError({ status: 403, code: 'FORBIDDEN', message: 'No access' });

    expect(describeError(api)).toBe('ApiError 403 FORBIDDEN');
    expect(describeError(new AuthPortError('credentials.read', 'timedOut'))).toBe(
      'AuthPortError credentials.read timedOut',
    );
    expect(describeError(new RangeError('too large'))).toBe('RangeError: too large');
    expect(describeError('text')).toBe('unknown');
  });
});

describe('messages', () => {
  const keys = Object.keys(MESSAGES.en).filter((key): key is MessageKey => key in MESSAGES.en);

  it('has every key in both languages, each taking a value or not in both', () => {
    expect(Object.keys(MESSAGES.ar).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(MESSAGES.ar[key].trim()).not.toBe('');
      expect(MESSAGES.ar[key].includes('{value}'), key).toBe(MESSAGES.en[key].includes('{value}'));
    }
  });

  it.each([
    ['ar', 'ar'],
    ['ar-SA', 'ar'],
    ['ar_EG', 'ar'],
    ['AR-eg', 'ar'],
    ['en-US', 'en'],
    ['arn-CL', 'en'],
    ['fr', 'en'],
    ['', 'en'],
    [undefined, 'en'],
  ])('reads the locale tag %j as %s', (tag, expected) => {
    expect(resolveLocale(tag)).toBe(expected);
  });

  it('lays Arabic out right to left and English left to right', () => {
    expect(DIRECTION).toEqual({ en: 'ltr', ar: 'rtl' });
  });

  it('puts the value into the message as it is', () => {
    for (const locale of ['en', 'ar'] as const) {
      const text = translate(locale, 'status', 'a$&b');

      expect(text).toContain('a$&b');
      expect(text).not.toContain('{value}');
      expect(text.length).toBe(MESSAGES[locale].status.length - '{value}'.length + 'a$&b'.length);
    }
  });

  it('returns a message without a value unchanged', () => {
    expect(translate('ar', 'signIn')).toBe(MESSAGES.ar.signIn);
  });
});
