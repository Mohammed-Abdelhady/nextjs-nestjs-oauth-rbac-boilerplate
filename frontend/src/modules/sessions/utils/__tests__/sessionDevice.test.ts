import { describe, expect, it } from 'vitest';
import { describeNativeDevice, sessionKindOf } from '../sessionDevice';

describe('sessionKindOf', () => {
  it.each([
    ['browser_session', 'browser'],
    ['native_access', 'nativeApp'],
  ])('reads %s as %s', (purpose, kind) => {
    expect(sessionKindOf(purpose)).toBe(kind);
  });

  it.each(['native_refresh', '', 'NATIVE_ACCESS', 'constructor', 'toString'])(
    'has no kind for "%s"',
    (purpose) => {
      expect(sessionKindOf(purpose)).toBeUndefined();
    },
  );
});

describe('describeNativeDevice', () => {
  it.each([
    ['an HTTP client that names no system', 'okhttp/4.12.0'],
    ['the placeholder the server stores for a missing agent', 'native'],
    ['an empty agent', ''],
  ])('is a phone with no system name for %s', (_label, userAgent) => {
    expect(describeNativeDevice(userAgent)).toEqual({ deviceType: 'Mobile', os: null });
  });

  it('names the system an app reports', () => {
    expect(describeNativeDevice('Acme/2.1 (iPhone; iPhone OS 17_2)')).toEqual({
      deviceType: 'Mobile',
      os: 'iOS 17',
    });
  });

  it.each([
    ['Acme/2.1 (iPad; CPU OS 17_2 like Mac OS X)', 'iPadOS 17'],
    ['Acme/2.1 (Linux; Android 14; Pixel Tablet)', 'Android 14'],
  ])('keeps a tablet a tablet for %s', (userAgent, os) => {
    expect(describeNativeDevice(userAgent)).toEqual({ deviceType: 'Tablet', os });
  });
});
