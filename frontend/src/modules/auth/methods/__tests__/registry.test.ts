import { describe, expect, it } from 'vitest';
import { AUTH_METHOD_ID } from '../../constants/authMethods';
import type { AuthMethods } from '../../types/auth.types';
import { enabledAuthMethods } from '../registry';

function methods(overrides: Partial<AuthMethods> = {}): AuthMethods {
  return {
    password: false,
    magicLink: false,
    twoFactor: false,
    passkeys: false,
    oauth: [],
    ...overrides,
  };
}

const idsFor = (value: AuthMethods): string[] => enabledAuthMethods(value).map((e) => e.id);

describe('enabledAuthMethods', () => {
  it('renders nothing when the backend reports no method', () => {
    expect(idsFor(methods())).toEqual([]);
  });

  it('renders only the password form when only passwords are on', () => {
    expect(idsFor(methods({ password: true }))).toEqual([AUTH_METHOD_ID.PASSWORD]);
  });

  it('renders only the magic link form when only links are on', () => {
    expect(idsFor(methods({ magicLink: true }))).toEqual([AUTH_METHOD_ID.MAGIC_LINK]);
  });

  it('puts the password form above the magic link form', () => {
    expect(idsFor(methods({ password: true, magicLink: true }))).toEqual([
      AUTH_METHOD_ID.PASSWORD,
      AUTH_METHOD_ID.MAGIC_LINK,
    ]);
  });

  it('ignores OAuth and the second factor, which the page renders itself', () => {
    const oauthOnly = methods({ oauth: [{ id: 'google', displayName: 'Google' }] });
    expect(idsFor(oauthOnly)).toEqual([]);
    expect(idsFor(methods({ twoFactor: true }))).toEqual([]);
  });

  it('does not render passkeys yet, even when the backend reports them', () => {
    expect(idsFor(methods({ passkeys: true }))).toEqual([]);
  });
});
