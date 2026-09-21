import { randomBytes } from 'crypto';
import request from 'supertest';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import {
  NATIVE_ACCESS_LIFETIME_MS,
  NATIVE_INITIAL_IDLE_MS,
} from '../constants/session-policy';
import {
  NATIVE_CLIENT_ID,
  NATIVE_META,
  NATIVE_REDIRECT,
  NATIVE_STARTED,
  NativeOauthHarness,
  issueNativeGrant,
  nativeAuthorizeQuery,
  resetNativeClient,
  startNativeOauth,
  stopNativeOauth,
  nativeHttpServer,
} from './native-oauth.fixture';
import { createTestUser } from '../../../test/utils/session-authority-harness';

jest.setTimeout(60000);

describe('native authorization (plan 04)', () => {
  let ctx: NativeOauthHarness;

  beforeAll(async () => {
    ctx = await startNativeOauth('native_authorization');
  });

  afterAll(async () => {
    if (ctx) {
      await stopNativeOauth(ctx);
    }
  });

  beforeEach(async () => {
    await resetNativeClient(ctx);
  });

  it('refuses to start when native issuance is disabled', async () => {
    jest
      .spyOn(ctx.harness.app.get(AuthEpochService), 'nativeEnabled')
      .mockReturnValueOnce(false);
    const result = await ctx.authorize.begin(
      nativeAuthorizeQuery('a'.repeat(43)),
    );
    expect(result).toEqual({
      ok: false,
      status: 400,
      error: 'unauthorized_client',
    });
    expect(await ctx.transactions.countDocuments()).toBe(0);
  });

  it('rejects a foreign redirect and an implicit response before storing a transaction', async () => {
    const foreign = await ctx.authorize.begin(
      nativeAuthorizeQuery('a'.repeat(43), {
        redirect_uri: 'myapp://callback.evil',
      }),
    );
    const implicit = await ctx.authorize.begin(
      nativeAuthorizeQuery('a'.repeat(43), { response_type: 'token' }),
    );
    expect(foreign).toMatchObject({ ok: false, error: 'invalid_request' });
    expect(implicit).toMatchObject({
      ok: false,
      error: 'unsupported_response_type',
    });
    expect(await ctx.transactions.countDocuments()).toBe(0);
  });

  it('sends the browser to the first-party login page', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const response = await request(nativeHttpServer(ctx.harness.app))
      .get('/api/oauth/authorize')
      .query(nativeAuthorizeQuery(verifier))
      .redirects(0);
    expect(response.status).toBe(302);
    expect(response.headers.location).toContain(
      'http://localhost:3000/login?native_transaction=',
    );
    expect(String(response.headers.location)).not.toContain('myapp://');
  });

  it('exchanges a code once and keeps the access token off the cookie session', async () => {
    const granted = await issueNativeGrant(ctx);
    expect(granted.expiresIn).toBe(NATIVE_ACCESS_LIFETIME_MS / 1000);
    const session = await ctx.harness.sessions.findOne({
      clientId: NATIVE_CLIENT_ID,
    });
    expect(session?.credentialPurpose).toBe(CREDENTIAL_PURPOSE.NATIVE_ACCESS);
    expect(session?.idleExpiresAt.getTime()).toBe(
      NATIVE_STARTED.getTime() + NATIVE_INITIAL_IDLE_MS,
    );
    expect(await ctx.access.validate(granted.accessToken)).not.toBeNull();
    expect(
      await ctx.harness.sessionService.validateSession(granted.accessToken),
    ).toBeNull();
    expect(await ctx.access.validate(granted.refreshToken)).toBeNull();
  });

  it('burns a code when the verifier is wrong', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const begun = await ctx.authorize.begin(nativeAuthorizeQuery(verifier));
    if (!begun.ok) {
      throw new Error(begun.error);
    }
    const user = await createTestUser(ctx.harness.users, 'native@example.com');
    const approved = await ctx.authorize.approve(
      user._id.toString(),
      begun.transactionId,
      ['password'],
    );
    const code = new URL(approved.redirectUri).searchParams.get('code') ?? '';
    const wrong = await ctx.tokens.grant(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: NATIVE_REDIRECT,
        client_id: NATIVE_CLIENT_ID,
        code_verifier: 'b'.repeat(43),
      },
      NATIVE_META,
    );
    expect(wrong).toMatchObject({ ok: false, error: 'invalid_grant' });
    expect(await ctx.harness.sessions.countDocuments()).toBe(0);
    expect(
      (await ctx.transactions.findOne({ transactionId: begun.transactionId }))
        ?.consumed,
    ).toBe(true);
  });

  it('lets only one of two concurrent exchanges create a session', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const begun = await ctx.authorize.begin(nativeAuthorizeQuery(verifier));
    if (!begun.ok) {
      throw new Error(begun.error);
    }
    const user = await createTestUser(ctx.harness.users, 'native@example.com');
    const approved = await ctx.authorize.approve(
      user._id.toString(),
      begun.transactionId,
      ['password'],
    );
    const code = new URL(approved.redirectUri).searchParams.get('code') ?? '';
    const body = {
      grant_type: 'authorization_code' as const,
      code,
      redirect_uri: NATIVE_REDIRECT,
      client_id: NATIVE_CLIENT_ID,
      code_verifier: verifier,
    };
    const [first, second] = await Promise.all([
      ctx.tokens.grant(body, NATIVE_META),
      ctx.tokens.grant(body, NATIVE_META),
    ]);
    expect([first, second].filter((result) => result.ok)).toHaveLength(1);
    expect(await ctx.harness.sessions.countDocuments({ isValid: true })).toBe(
      1,
    );
  });

  it('rejects a session cookie on the token endpoint without spending the code', async () => {
    const verifier = randomBytes(32).toString('base64url');
    const begun = await ctx.authorize.begin(nativeAuthorizeQuery(verifier));
    if (!begun.ok) {
      throw new Error(begun.error);
    }
    const user = await createTestUser(ctx.harness.users, 'native@example.com');
    const approved = await ctx.authorize.approve(
      user._id.toString(),
      begun.transactionId,
      ['password'],
    );
    const code = new URL(approved.redirectUri).searchParams.get('code') ?? '';
    const response = await request(nativeHttpServer(ctx.harness.app))
      .post('/api/oauth/token')
      .set('Cookie', 'sid=browser-session')
      .send({
        grant_type: 'authorization_code',
        code,
        redirect_uri: NATIVE_REDIRECT,
        client_id: NATIVE_CLIENT_ID,
        code_verifier: verifier,
      });
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'invalid_request' });
    expect(
      (await ctx.transactions.findOne({ transactionId: begun.transactionId }))
        ?.consumed,
    ).toBe(false);
    expect(await ctx.credentials.countDocuments()).toBe(0);
  });
});
