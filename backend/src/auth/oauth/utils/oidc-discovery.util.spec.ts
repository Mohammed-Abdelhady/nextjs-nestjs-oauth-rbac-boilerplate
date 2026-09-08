import {
  discoverEndpoints,
  discoveryUrl,
  normalizeIssuer,
  resolveManualEndpoints,
} from './oidc-discovery.util';
import { mockFetch } from '../strategies/oauth-strategy.harness-spec';

const ISSUER = 'https://sso.example.com';
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;

function discoveryDocument(overrides: Record<string, unknown> = {}) {
  return {
    issuer: ISSUER,
    authorization_endpoint: `${ISSUER}/authorize`,
    token_endpoint: `${ISSUER}/token`,
    userinfo_endpoint: `${ISSUER}/userinfo`,
    jwks_uri: `${ISSUER}/jwks`,
    code_challenge_methods_supported: ['S256'],
    id_token_signing_alg_values_supported: ['RS256', 'ES256'],
    ...overrides,
  };
}

describe('oidc-discovery.util', () => {
  describe('normalizeIssuer', () => {
    it('drops a trailing slash and surrounding spaces', () => {
      expect(normalizeIssuer(` ${ISSUER}/ `)).toBe(ISSUER);
    });
  });

  describe('discoveryUrl', () => {
    it('appends the well-known path once', () => {
      expect(discoveryUrl(`${ISSUER}/`)).toBe(DISCOVERY_URL);
    });
  });

  describe('resolveManualEndpoints', () => {
    const overrides = {
      authorizationUrl: `${ISSUER}/authorize`,
      tokenUrl: `${ISSUER}/token`,
      userInfoUrl: `${ISSUER}/userinfo`,
      jwksUri: `${ISSUER}/jwks`,
    };

    it('takes the four endpoints and leaves PKCE off', () => {
      expect(resolveManualEndpoints(`${ISSUER}/`, overrides)).toEqual({
        issuer: ISSUER,
        ...overrides,
        supportsPkceS256: false,
        signingAlgorithms: ['RS256'],
      });
    });

    it('returns nothing when one endpoint is missing', () => {
      expect(
        resolveManualEndpoints(ISSUER, { ...overrides, jwksUri: undefined }),
      ).toBeUndefined();
    });
  });

  describe('discoverEndpoints', () => {
    it('reads the endpoints and the PKCE capability', async () => {
      const fetchMock = mockFetch([
        { url: DISCOVERY_URL, body: discoveryDocument() },
      ]);

      const endpoints = await discoverEndpoints(ISSUER);

      expect(endpoints).toEqual({
        issuer: ISSUER,
        authorizationUrl: `${ISSUER}/authorize`,
        tokenUrl: `${ISSUER}/token`,
        userInfoUrl: `${ISSUER}/userinfo`,
        jwksUri: `${ISSUER}/jwks`,
        supportsPkceS256: true,
        signingAlgorithms: ['RS256', 'ES256'],
      });
      expect(fetchMock.callTo(DISCOVERY_URL).method).toBe('GET');
    });

    it('leaves PKCE off when the document lists no S256', async () => {
      mockFetch([
        {
          url: DISCOVERY_URL,
          body: discoveryDocument({
            code_challenge_methods_supported: ['plain'],
          }),
        },
      ]);

      expect((await discoverEndpoints(ISSUER)).supportsPkceS256).toBe(false);
    });

    it('lets environment overrides win over the published endpoints', async () => {
      mockFetch([{ url: DISCOVERY_URL, body: discoveryDocument() }]);

      const endpoints = await discoverEndpoints(ISSUER, {
        tokenUrl: 'https://internal.example.com/token',
      });

      expect(endpoints.tokenUrl).toBe('https://internal.example.com/token');
      expect(endpoints.authorizationUrl).toBe(`${ISSUER}/authorize`);
    });

    it('drops symmetric and unsigned algorithms', async () => {
      mockFetch([
        {
          url: DISCOVERY_URL,
          body: discoveryDocument({
            id_token_signing_alg_values_supported: ['HS256', 'none', 'PS512'],
          }),
        },
      ]);

      expect((await discoverEndpoints(ISSUER)).signingAlgorithms).toEqual([
        'PS512',
      ]);
    });

    it('falls back to RS256 when the document names nothing usable', async () => {
      mockFetch([
        {
          url: DISCOVERY_URL,
          body: discoveryDocument({
            id_token_signing_alg_values_supported: ['HS256'],
          }),
        },
      ]);

      expect((await discoverEndpoints(ISSUER)).signingAlgorithms).toEqual([
        'RS256',
      ]);
    });

    it('refuses a document issued for another issuer', async () => {
      mockFetch([
        {
          url: DISCOVERY_URL,
          body: discoveryDocument({ issuer: 'https://evil.example.com' }),
        },
      ]);

      await expect(discoverEndpoints(ISSUER)).rejects.toThrow(
        'discovery document is issued for',
      );
    });

    it('accepts an issuer that differs only by a trailing slash', async () => {
      mockFetch([
        {
          url: DISCOVERY_URL,
          body: discoveryDocument({ issuer: `${ISSUER}/` }),
        },
      ]);

      expect((await discoverEndpoints(ISSUER)).issuer).toBe(ISSUER);
    });

    it('refuses a document with no token endpoint', async () => {
      mockFetch([
        {
          url: DISCOVERY_URL,
          body: discoveryDocument({ token_endpoint: undefined }),
        },
      ]);

      await expect(discoverEndpoints(ISSUER)).rejects.toThrow(
        'discovery document is missing',
      );
    });

    it('reports an HTTP error from the discovery request', async () => {
      mockFetch([{ url: DISCOVERY_URL, status: 404, body: {} }]);

      await expect(discoverEndpoints(ISSUER)).rejects.toThrow(
        'discovery request failed: 404',
      );
    });
  });
});
