import { resolveNativeDpopTokenAddress } from './native-dpop.service';
import { OAUTH_ERROR } from './native-oauth.types';

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
});

describe('native DPoP OAuth errors', () => {
  it('uses the protocol error code for a refused proof', () => {
    expect(OAUTH_ERROR.INVALID_DPOP_PROOF).toBe('invalid_dpop_proof');
  });
});
