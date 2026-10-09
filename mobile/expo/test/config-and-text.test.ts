import { describe, expect, it } from 'vitest';
import {
  DIRECTION,
  MESSAGES,
  resolveLocale,
  translate,
  type MessageKey,
} from '../src/i18n/messages';
import { resolveConfig } from '../src/logic/resolve-config';

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

describe('messages', () => {
  const keys = Object.keys(MESSAGES.en).filter((key): key is MessageKey => key in MESSAGES.en);

  it('has every key in both languages, each taking a value or not in both', () => {
    expect(Object.keys(MESSAGES.ar).sort()).toEqual([...keys].sort());
    for (const key of keys) {
      expect(MESSAGES.ar[key].trim()).not.toBe('');
      expect(MESSAGES.ar[key].includes('{value}'), key).toBe(MESSAGES.en[key].includes('{value}'));
      expect(MESSAGES.ar[key].includes('{detail}'), key).toBe(
        MESSAGES.en[key].includes('{detail}'),
      );
      expect(MESSAGES.ar[key].replace(/\{(?:value|detail)\}/g, ''), key).not.toMatch(/[A-Za-z]/);
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

  it('puts a second part into a message that takes one', () => {
    const text = translate('en', 'signOutSignedOutWithError', 'first', 'second');

    expect(text).toBe('signed out, first, second');
  });

  it('returns a message without a value unchanged', () => {
    expect(translate('ar', 'signIn')).toBe(MESSAGES.ar.signIn);
  });
});
