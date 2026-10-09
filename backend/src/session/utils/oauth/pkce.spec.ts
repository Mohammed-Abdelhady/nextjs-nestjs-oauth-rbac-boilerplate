import { pkceMatches, pkceS256 } from './pkce';

const VERIFIER = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const CHALLENGE = 'ZtNPunH49FD35FWYhT5Tv8I7vRKQJ8uxMaL0_9eHjNA';

describe('pkce S256', () => {
  it('matches the SHA-256 challenge for a 43-character verifier', () => {
    expect(pkceS256(VERIFIER)).toBe(CHALLENGE);
    expect(pkceMatches(VERIFIER, CHALLENGE)).toBe(true);
  });

  it('rejects a verifier on either side of the length limit', () => {
    expect(pkceMatches('a'.repeat(42), CHALLENGE)).toBe(false);
    expect(pkceMatches('a'.repeat(129), CHALLENGE)).toBe(false);
    expect(pkceMatches(`${VERIFIER} `, CHALLENGE)).toBe(false);
  });

  it('rejects a challenge that differs by one character', () => {
    expect(pkceMatches(VERIFIER, `${CHALLENGE.slice(0, -1)}B`)).toBe(false);
  });
});
