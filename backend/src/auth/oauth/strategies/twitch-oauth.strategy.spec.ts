import type { JWTPayload } from 'jose';
import { TwitchOAuthStrategy } from './twitch-oauth.strategy';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  SigningKey,
  configFor,
  createSigningKey,
  expectAppException,
  mockFetch,
  signIdToken,
} from './oauth-strategy.harness-spec';

const CLIENT_ID = 'twitch-client-id';
const ISSUER = 'https://id.twitch.tv/oauth2';
const AUTH_URL = `${ISSUER}/authorize`;
const TOKEN_URL = `${ISSUER}/token`;
const USERINFO_URL = `${ISSUER}/userinfo`;
const JWKS_URI = `${ISSUER}/keys`;
const REDIRECT_URI = 'https://api.example.com/api/auth/oauth/twitch/callback';

interface Claims extends JWTPayload {
  sub: string;
  email?: string;
  email_verified?: boolean;
  preferred_username?: string;
  nonce?: string;
  iss?: string;
  aud?: string;
}

function baseClaims(overrides: Partial<Claims> = {}): Claims {
  return {
    sub: '123456789',
    email: 'streamer@example.com',
    email_verified: true,
    preferred_username: 'teststreamer',
    iss: ISSUER,
    aud: CLIENT_ID,
    ...overrides,
  };
}

function strategy(): TwitchOAuthStrategy {
  return new TwitchOAuthStrategy(
    configFor('twitch', {
      clientId: CLIENT_ID,
      clientSecret: 'twitch-client-secret',
    }),
  );
}

describe('TwitchOAuthStrategy', () => {
  let key: SigningKey;

  beforeAll(async () => {
    key = await createSigningKey();
  });

  describe('getAuthorizationUrl', () => {
    it('asks for the email claim by name and sends no code challenge', () => {
      const url = new URL(
        strategy().getAuthorizationUrl({
          state: 'state-value',
          redirectUri: REDIRECT_URI,
          codeChallenge: 'challenge',
          nonce: 'nonce-value',
        }),
      );

      expect(url.origin + url.pathname).toBe(AUTH_URL);
      expect(url.searchParams.get('scope')).toBe('openid user:read:email');
      expect(url.searchParams.get('nonce')).toBe('nonce-value');
      expect(url.searchParams.get('code_challenge')).toBeNull();
      expect(JSON.parse(url.searchParams.get('claims') ?? '')).toEqual({
        userinfo: {
          email: null,
          email_verified: null,
          preferred_username: null,
          picture: null,
        },
      });
    });
  });

  describe('exchangeCode', () => {
    it('posts the client secret in the body and checks the nonce', async () => {
      const idToken = await signIdToken({
        key,
        claims: { ...baseClaims(), nonce: 'nonce-value' },
      });
      const fetchMock = mockFetch([
        { url: JWKS_URI, body: key.jwks },
        {
          url: TOKEN_URL,
          body: {
            access_token: 'access-token',
            id_token: idToken,
            scope: ['openid', 'user:read:email'],
          },
        },
      ]);

      const tokens = await strategy().exchangeCode({
        code: 'auth-code',
        redirectUri: REDIRECT_URI,
        nonce: 'nonce-value',
      });

      expect(tokens.accessToken).toBe('access-token');
      // Twitch answers with an array of scopes where the others send a string.
      expect(tokens.scope).toBe('openid user:read:email');

      const tokenCall = fetchMock.callTo(TOKEN_URL);
      expect(tokenCall.method).toBe('POST');
      expect(tokenCall.body.client_secret).toBe('twitch-client-secret');
      expect(tokenCall.headers.Authorization).toBeUndefined();
    });

    it('rejects an id_token whose nonce does not match', async () => {
      const idToken = await signIdToken({
        key,
        claims: { ...baseClaims(), nonce: 'other-nonce' },
      });
      mockFetch([
        { url: JWKS_URI, body: key.jwks },
        {
          url: TOKEN_URL,
          body: { access_token: 'access-token', id_token: idToken },
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
          body: { access_token: 'access-token', id_token: idToken },
        },
      ]);

      await expectAppException(
        strategy().exchangeCode({
          code: 'auth-code',
          redirectUri: REDIRECT_URI,
        }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });

    it('reports a rejected code as OAUTH_CODE_INVALID', async () => {
      mockFetch([
        {
          url: TOKEN_URL,
          body: { error: 'Bad Request', message: 'Invalid authorization code' },
        },
      ]);

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

    it('uses sub as the provider id and the login name as the name', async () => {
      const profile = await profileWith(baseClaims(), {
        sub: '123456789',
        preferred_username: 'teststreamer',
        email: 'streamer@example.com',
        email_verified: true,
        picture:
          'https://static-cdn.jtvnw.net/user-default-pictures/avatar.png',
      });

      expect(profile).toEqual({
        providerId: '123456789',
        email: 'streamer@example.com',
        emailVerified: true,
        name: 'teststreamer',
        avatarUrl:
          'https://static-cdn.jtvnw.net/user-default-pictures/avatar.png',
      });
    });

    it('passes an unverified address through as unverified', async () => {
      const profile = await profileWith(baseClaims({ email_verified: false }), {
        sub: '123456789',
        email: 'streamer@example.com',
        email_verified: false,
      });

      expect(profile.emailVerified).toBe(false);
    });

    it('fails when the claims request did not bring back an email', async () => {
      await expectAppException(
        profileWith(baseClaims({ email: undefined }), { sub: '123456789' }),
        ErrorCode.OAUTH_AUTHENTICATION_FAILED,
      );
    });
  });
});
