import { LinkedInOAuthStrategy } from './linkedin-oauth.strategy';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  SigningKey,
  configFor,
  createSigningKey,
  expectAppException,
  mockFetch,
  signIdToken,
} from './oauth-strategy.harness-spec';

const CLIENT_ID = 'linkedin-client-id';
const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const JWKS_URI = 'https://www.linkedin.com/oauth/openid/jwks';
const ISSUER = 'https://www.linkedin.com/oauth';
const SUBJECT = 'BgU8Sd_gZ9';
const REDIRECT_URI = 'https://api.example.com/api/auth/oauth/linkedin/callback';

function strategy(): LinkedInOAuthStrategy {
  return new LinkedInOAuthStrategy(
    configFor('linkedin', {
      clientId: CLIENT_ID,
      clientSecret: 'linkedin-client-secret',
    }),
  );
}

function userInfo(overrides: Record<string, unknown> = {}) {
  return {
    sub: SUBJECT,
    name: 'Ada Lovelace',
    given_name: 'Ada',
    family_name: 'Lovelace',
    picture: 'https://media.licdn.com/dms/image/profile.jpg',
    email: 'ada@example.com',
    email_verified: true,
    ...overrides,
  };
}

describe('LinkedInOAuthStrategy', () => {
  let key: SigningKey;

  async function idToken(claims: Record<string, unknown> = {}) {
    return signIdToken({
      key,
      claims: { iss: ISSUER, aud: CLIENT_ID, sub: SUBJECT, ...claims },
    });
  }

  beforeAll(async () => {
    key = await createSigningKey();
  });

  describe('getAuthorizationUrl', () => {
    it('requests the OpenID Connect scopes without PKCE or a nonce', () => {
      const url = new URL(
        strategy().getAuthorizationUrl({
          state: 'state-value',
          redirectUri: REDIRECT_URI,
          codeChallenge: 'challenge',
          nonce: 'nonce-value',
        }),
      );

      expect(url.origin + url.pathname).toBe(AUTH_URL);
      expect(url.searchParams.get('scope')).toBe('openid profile email');
      expect(url.searchParams.get('state')).toBe('state-value');
      expect(url.searchParams.has('code_challenge')).toBe(false);
      expect(url.searchParams.has('nonce')).toBe(false);
    });
  });

  describe('flags', () => {
    it('declares no PKCE and no nonce, because LinkedIn takes neither', () => {
      const linkedin = strategy();

      expect(linkedin.supportsPkce).toBe(false);
      expect(linkedin.usesOidc).toBe(false);
      expect(linkedin.callbackMethod).toBe('GET');
    });
  });

  describe('exchangeCode', () => {
    it('verifies the id_token signature and issuer', async () => {
      const token = await idToken();
      const fetchMock = mockFetch([
        { url: JWKS_URI, body: key.jwks },
        {
          url: TOKEN_URL,
          body: {
            access_token: 'access-token',
            id_token: token,
            expires_in: 5184000,
            scope: 'openid profile email',
          },
        },
      ]);

      const tokens = await strategy().exchangeCode({
        code: 'auth-code',
        redirectUri: REDIRECT_URI,
      });

      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.idToken).toBe(token);
      expect(fetchMock.callTo(TOKEN_URL).body.grant_type).toBe(
        'authorization_code',
      );
    });

    it('rejects an id_token from another issuer', async () => {
      const token = await idToken({ iss: 'https://impostor.example.com' });
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        { url: TOKEN_URL, body: { access_token: 'a', id_token: token } },
      ]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });

    it('rejects an id_token issued for another client', async () => {
      const token = await idToken({ aud: 'someone-else' });
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        { url: TOKEN_URL, body: { access_token: 'a', id_token: token } },
      ]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });

    it('fails when the token response carries no id_token', async () => {
      mockFetch([{ url: TOKEN_URL, body: { access_token: 'access-token' } }]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
        }),
        ErrorCode.OAUTH_CODE_INVALID,
      );
    });
  });

  describe('fetchProfile', () => {
    it('takes the provider id from the id_token and the email from userinfo', async () => {
      const token = await idToken();
      const fetchMock = mockFetch([
        { url: JWKS_URI, body: key.jwks },
        { url: USERINFO_URL, body: userInfo() },
      ]);

      const profile = await strategy().fetchProfile({
        accessToken: 'access-token',
        idToken: token,
      });

      expect(profile).toEqual({
        providerId: SUBJECT,
        email: 'ada@example.com',
        emailVerified: true,
        name: 'Ada Lovelace',
        avatarUrl: 'https://media.licdn.com/dms/image/profile.jpg',
      });
      expect(fetchMock.callTo(USERINFO_URL).headers.Authorization).toBe(
        'Bearer access-token',
      );
    });

    it('passes an unverified address through as unverified', async () => {
      const token = await idToken();
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        { url: USERINFO_URL, body: userInfo({ email_verified: false }) },
      ]);

      const profile = await strategy().fetchProfile({
        accessToken: 'access-token',
        idToken: token,
      });

      expect(profile.emailVerified).toBe(false);
    });

    it('fails when userinfo returns no email', async () => {
      const token = await idToken();
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        { url: USERINFO_URL, body: userInfo({ email: undefined }) },
      ]);

      await expectAppException(
        strategy().fetchProfile({
          accessToken: 'access-token',
          idToken: token,
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });
  });
});
