import type { JWTPayload } from 'jose';
import { OidcOAuthStrategy } from './oidc-oauth.strategy';
import { configFor } from './oauth-strategy.harness-spec';

/**
 * Fixtures shared by the two generic OIDC spec files. Nothing here is a test
 * suite; the file name keeps it out of jest's testRegex.
 */

export const CLIENT_ID = 'oidc-client-id';
export const CLIENT_SECRET = 'oidc-client-secret';
export const ISSUER = 'https://sso.example.com';
export const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
export const AUTH_URL = `${ISSUER}/authorize`;
export const TOKEN_URL = `${ISSUER}/token`;
export const USERINFO_URL = `${ISSUER}/userinfo`;
export const JWKS_URI = `${ISSUER}/jwks`;
export const REDIRECT_URI =
  'https://api.example.com/api/auth/oauth/oidc/callback';

const MANUAL_ENDPOINTS: Record<string, string> = {
  AUTHORIZATION_URL: AUTH_URL,
  TOKEN_URL,
  USERINFO_URL,
  JWKS_URL: JWKS_URI,
};

export interface OidcClaims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  iss?: string;
  aud?: string;
}

export function baseClaims(overrides: Partial<OidcClaims> = {}): OidcClaims {
  return {
    sub: 'subject-id',
    email: 'user@example.com',
    email_verified: true,
    name: 'Test User',
    iss: ISSUER,
    aud: CLIENT_ID,
    ...overrides,
  };
}

export function discoveryDocument(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    issuer: ISSUER,
    authorization_endpoint: AUTH_URL,
    token_endpoint: TOKEN_URL,
    userinfo_endpoint: USERINFO_URL,
    jwks_uri: JWKS_URI,
    code_challenge_methods_supported: ['S256'],
    ...overrides,
  };
}

/** Provider that has to read the discovery document before it works. */
export function discoveringStrategy(
  extra: Record<string, string> = {},
): OidcOAuthStrategy {
  return new OidcOAuthStrategy(
    configFor('oidc', {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      extra: { ISSUER, ...extra },
    }),
  );
}

/** Provider whose endpoints are all set by hand, so it needs no discovery. */
export function manualStrategy(
  extra: Record<string, string> = {},
): OidcOAuthStrategy {
  return discoveringStrategy({ ...MANUAL_ENDPOINTS, ...extra });
}
