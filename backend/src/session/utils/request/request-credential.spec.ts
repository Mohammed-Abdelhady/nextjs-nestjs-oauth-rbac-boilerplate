import {
  REQUEST_CREDENTIAL,
  hasBothCredentials,
  selectRequestCredential,
} from './request-credential';

describe('selectRequestCredential', () => {
  it.each([
    {
      label: 'bearer alone',
      hasBearerToken: true,
      hasSessionCookie: false,
      expected: REQUEST_CREDENTIAL.BEARER,
    },
    {
      label: 'cookie alone',
      hasBearerToken: false,
      hasSessionCookie: true,
      expected: REQUEST_CREDENTIAL.COOKIE,
    },
    {
      label: 'neither credential',
      hasBearerToken: false,
      hasSessionCookie: false,
      expected: REQUEST_CREDENTIAL.NONE,
    },
    {
      label: 'bearer wins over the cookie',
      hasBearerToken: true,
      hasSessionCookie: true,
      expected: REQUEST_CREDENTIAL.BEARER,
    },
  ])(
    '$label selects $expected',
    ({ hasBearerToken, hasSessionCookie, expected }) => {
      expect(selectRequestCredential(hasBearerToken, hasSessionCookie)).toBe(
        expected,
      );
    },
  );
});

describe('hasBothCredentials', () => {
  it.each([
    {
      label: 'bearer and cookie',
      hasBearerToken: true,
      hasSessionCookie: true,
      expected: true,
    },
    {
      label: 'bearer alone',
      hasBearerToken: true,
      hasSessionCookie: false,
      expected: false,
    },
    {
      label: 'cookie alone',
      hasBearerToken: false,
      hasSessionCookie: true,
      expected: false,
    },
    {
      label: 'neither credential',
      hasBearerToken: false,
      hasSessionCookie: false,
      expected: false,
    },
  ])(
    '$label is $expected',
    ({ hasBearerToken, hasSessionCookie, expected }) => {
      expect(hasBothCredentials(hasBearerToken, hasSessionCookie)).toBe(
        expected,
      );
    },
  );
});
