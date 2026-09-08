import type { JWTPayload } from 'jose';
import { SlackOAuthStrategy } from './slack-oauth.strategy';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  SigningKey,
  configFor,
  createSigningKey,
  expectAppException,
  mockFetch,
  signIdToken,
} from './oauth-strategy.harness-spec';

const CLIENT_ID = 'slack-client-id';
const ISSUER = 'https://slack.com';
const AUTH_URL = `${ISSUER}/openid/connect/authorize`;
const TOKEN_URL = `${ISSUER}/api/openid.connect.token`;
const USERINFO_URL = `${ISSUER}/api/openid.connect.userInfo`;
const JWKS_URI = `${ISSUER}/openid/connect/keys`;
const REDIRECT_URI = 'https://api.example.com/api/auth/oauth/slack/callback';
/** Slack subjects carry the team and the user, so one string identifies both. */
const SUBJECT = 'T0R7GTNDS-U0R7JM';

interface Claims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  nonce?: string;
  iss?: string;
  aud?: string;
}

function baseClaims(overrides: Partial<Claims> = {}): Claims {
  return {
    sub: SUBJECT,
    email: 'user@example.com',
    email_verified: true,
    name: 'Test User',
    nonce: 'nonce-value',
    iss: ISSUER,
    aud: CLIENT_ID,
    ...overrides,
  };
}

function strategy(): SlackOAuthStrategy {
  return new SlackOAuthStrategy(
    configFor('slack', {
      clientId: CLIENT_ID,
      clientSecret: 'slack-client-secret',
    }),
  );
}

describe('SlackOAuthStrategy', () => {
  let key: SigningKey;

  beforeAll(async () => {
    key = await createSigningKey();
  });

  describe('getAuthorizationUrl', () => {
    it('asks for the OIDC scopes with a nonce and a query response mode', () => {
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
      expect(url.searchParams.get('response_mode')).toBe('query');
      expect(url.searchParams.get('nonce')).toBe('nonce-value');
      expect(url.searchParams.get('code_challenge')).toBeNull();
    });
  });

  describe('exchangeCode', () => {
    it('posts the client secret in the body and checks the nonce', async () => {
      const idToken = await signIdToken({ key, claims: baseClaims() });
      const fetchMock = mockFetch([
        { url: JWKS_URI, body: key.jwks },
        {
          url: TOKEN_URL,
          body: { ok: true, access_token: 'access-token', id_token: idToken },
        },
      ]);

      const tokens = await strategy().exchangeCode({
        code: 'auth-code',
        redirectUri: REDIRECT_URI,
        nonce: 'nonce-value',
      });

      expect(tokens.accessToken).toBe('access-token');
      expect(tokens.idToken).toBe(idToken);

      const tokenCall = fetchMock.callTo(TOKEN_URL);
      expect(tokenCall.method).toBe('POST');
      expect(tokenCall.body.client_secret).toBe('slack-client-secret');
      expect(tokenCall.headers.Authorization).toBeUndefined();
    });

    it('refuses to exchange without a nonce', async () => {
      mockFetch([]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
        }),
        ErrorCode.OAUTH_CODE_INVALID,
      );
    });

    it('reads an error out of a 200 response with ok false', async () => {
      mockFetch([
        { url: TOKEN_URL, body: { ok: false, error: 'invalid_code' } },
      ]);

      const exception = await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
          nonce: 'nonce-value',
        }),
        ErrorCode.OAUTH_CODE_INVALID,
      );

      expect(exception.getStatus()).toBe(400);
    });

    it('rejects an id_token whose nonce does not match', async () => {
      const idToken = await signIdToken({
        key,
        claims: baseClaims({ nonce: 'other-nonce' }),
      });
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        {
          url: TOKEN_URL,
          body: { ok: true, access_token: 'access-token', id_token: idToken },
        },
      ]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
          nonce: 'nonce-value',
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });

    it('rejects an id_token signed by an unknown key', async () => {
      const otherKey = await createSigningKey();
      const idToken = await signIdToken({
        key: otherKey,
        claims: baseClaims(),
      });
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        {
          url: TOKEN_URL,
          body: { ok: true, access_token: 'access-token', id_token: idToken },
        },
      ]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
          nonce: 'nonce-value',
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });
  });

  describe('fetchProfile', () => {
    async function profileWith(claims: Claims, userInfo: unknown) {
      const idToken = await signIdToken({ key, claims });
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        { url: USERINFO_URL, body: userInfo },
      ]);

      return strategy().fetchProfile({
        accessToken: 'access-token',
        idToken,
      });
    }

    it('keeps the workspace and user subject as the provider id', async () => {
      const profile = await profileWith(baseClaims(), {
        ok: true,
        sub: SUBJECT,
        name: 'Test User',
        email: 'user@example.com',
        picture: 'https://avatars.slack-edge.com/avatar.png',
      });

      expect(profile).toEqual({
        providerId: SUBJECT,
        email: 'user@example.com',
        emailVerified: true,
        name: 'Test User',
        avatarUrl: 'https://avatars.slack-edge.com/avatar.png',
      });
    });

    it('takes the verification flag from the id_token, not userinfo', async () => {
      const profile = await profileWith(baseClaims({ email_verified: false }), {
        ok: true,
        sub: SUBJECT,
        email: 'user@example.com',
        email_verified: true,
      });

      expect(profile.emailVerified).toBe(false);
    });

    it('reports a userinfo response with ok false', async () => {
      await expectAppException(
        profileWith(baseClaims(), { ok: false, error: 'invalid_auth' }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });

    it('fails when no email is available', async () => {
      await expectAppException(
        profileWith(baseClaims({ email: undefined }), {
          ok: true,
          sub: SUBJECT,
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });
  });
});
