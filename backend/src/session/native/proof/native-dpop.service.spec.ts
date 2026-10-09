import {
  resolveNativeDpopAddress,
  resolveNativeDpopTokenAddress,
} from './native-dpop.service';
import {
  NATIVE_DPOP_REVOKE_PATH,
  NATIVE_DPOP_TOKEN_PATH,
} from '../../constants/session-policy';
import { OAUTH_ERROR } from '../oauth/native-oauth.types';

describe('native DPoP token address', () => {
  it.each([
    [
      'an origin with a trailing slash',
      'https://api.example.test/',
      'https://api.example.test/api/oauth/token',
    ],
    [
      'an origin with a path prefix',
      'https://api.example.test/gateway',
      'https://api.example.test/gateway/api/oauth/token',
    ],
    [
      'a path prefix ending in a slash',
      'https://api.example.test/gateway/',
      'https://api.example.test/gateway/api/oauth/token',
    ],
  ])('appends the token path to %s', (_label, apiOrigin, expectedAddress) => {
    expect(resolveNativeDpopTokenAddress(apiOrigin)).toBe(expectedAddress);
  });

  it.each([
    [
      'token path after a trailing slash and prefix',
      'https://api.example.test/gateway/',
      NATIVE_DPOP_TOKEN_PATH,
      'https://api.example.test/gateway/api/oauth/token',
    ],
    [
      'revoke path after a trailing slash and prefix',
      'https://api.example.test/gateway/',
      NATIVE_DPOP_REVOKE_PATH,
      'https://api.example.test/gateway/api/oauth/revoke',
    ],
    [
      'token path after a prefix without a slash',
      'https://api.example.test/v2',
      NATIVE_DPOP_TOKEN_PATH,
      'https://api.example.test/v2/api/oauth/token',
    ],
    [
      'revoke path after a prefix without a slash',
      'https://api.example.test/v2',
      NATIVE_DPOP_REVOKE_PATH,
      'https://api.example.test/v2/api/oauth/revoke',
    ],
  ] as const)('resolves the %s', (_label, apiOrigin, path, expectedAddress) => {
    expect(resolveNativeDpopAddress(apiOrigin, path)).toBe(expectedAddress);
  });
});

describe('native DPoP OAuth errors', () => {
  it('uses the protocol error code for a refused proof', () => {
    expect(OAUTH_ERROR.INVALID_DPOP_PROOF).toBe('invalid_dpop_proof');
  });
});
