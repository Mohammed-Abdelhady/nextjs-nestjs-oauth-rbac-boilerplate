import { randomBytes } from 'crypto';
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
} from './native-oauth.fixture';
import {
  NATIVE_ACCESS_LIFETIME_MS,
  NATIVE_INITIAL_IDLE_MS,
} from '../constants/session-policy';
import { createTestUser } from '../../../test/utils/session-authority-harness';

jest.setTimeout(60000);

describe('native token rotation (plan 04)', () => {
  let ctx: NativeOauthHarness;

  beforeAll(async () => {
    ctx = await startNativeOauth('native_token');
  });

  afterAll(async () => {
    if (ctx) {
      await stopNativeOauth(ctx);
    }
  });

  beforeEach(async () => {
    await resetNativeClient(ctx);
  });

  it('rejects a reused refresh token and the successor it already issued', async () => {
    const granted = await issueNativeGrant(ctx);
    const rotated = await ctx.tokens.grant(
      {
        grant_type: 'refresh_token',
        refresh_token: granted.refreshToken,
        client_id: NATIVE_CLIENT_ID,
      },
      NATIVE_META,
    );
    if (!rotated.ok) {
      throw new Error(rotated.error);
    }
    const session = await ctx.harness.sessions.findOne({
      clientId: NATIVE_CLIENT_ID,
    });
    expect(session?.idleExpiresAt.getTime()).toBe(
      NATIVE_STARTED.getTime() + NATIVE_INITIAL_IDLE_MS,
    );
    const replay = await ctx.tokens.grant(
      {
        grant_type: 'refresh_token',
        refresh_token: granted.refreshToken,
        client_id: NATIVE_CLIENT_ID,
      },
      NATIVE_META,
    );
    const successor = await ctx.tokens.grant(
      {
        grant_type: 'refresh_token',
        refresh_token: rotated.refreshToken,
        client_id: NATIVE_CLIENT_ID,
      },
      NATIVE_META,
    );
    expect(replay).toMatchObject({ ok: false, error: 'invalid_grant' });
    expect(successor).toMatchObject({ ok: false, error: 'invalid_grant' });
    expect(
      (await ctx.harness.sessions.findOne({ clientId: NATIVE_CLIENT_ID }))
        ?.isValid,
    ).toBe(false);
  });

  it('stops accepting an access token at the exact five-minute deadline', async () => {
    const granted = await issueNativeGrant(ctx);
    ctx.harness.clock.set(
      new Date(NATIVE_STARTED.getTime() + NATIVE_ACCESS_LIFETIME_MS - 1),
    );
    expect(await ctx.access.validate(granted.accessToken)).not.toBeNull();
    ctx.harness.clock.set(
      new Date(NATIVE_STARTED.getTime() + NATIVE_ACCESS_LIFETIME_MS),
    );
    expect(await ctx.access.validate(granted.accessToken)).toBeNull();
  });

  it('treats an unknown revoke as success and leaves another client untouched', async () => {
    const granted = await issueNativeGrant(ctx);
    expect(await ctx.tokens.revoke({ token: 'missing-token' })).toEqual({
      ok: true,
    });
    expect(
      await ctx.tokens.revoke({
        token: granted.accessToken,
        client_id: 'other-app',
      }),
    ).toEqual({ ok: true });
    expect(await ctx.access.validate(granted.accessToken)).not.toBeNull();
    expect(await ctx.tokens.revoke({ token: granted.accessToken })).toEqual({
      ok: true,
    });
    expect(await ctx.access.validate(granted.accessToken)).toBeNull();
  });

  it('rejects a password grant without creating a session', async () => {
    const result = await ctx.tokens.grant(
      { grant_type: 'password', client_id: NATIVE_CLIENT_ID },
      NATIVE_META,
    );
    expect(result).toMatchObject({
      ok: false,
      error: 'unsupported_grant_type',
    });
    expect(await ctx.harness.sessions.countDocuments()).toBe(0);
  });

  it('creates no session when the user version changed after approval', async () => {
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
    await ctx.harness.users.updateOne(
      { _id: user._id },
      { $inc: { sessionVersion: 1 } },
    );
    const code = new URL(approved.redirectUri).searchParams.get('code') ?? '';
    const granted = await ctx.tokens.grant(
      {
        grant_type: 'authorization_code',
        code,
        redirect_uri: NATIVE_REDIRECT,
        client_id: NATIVE_CLIENT_ID,
        code_verifier: verifier,
      },
      NATIVE_META,
    );
    expect(granted).toMatchObject({ ok: false, error: 'invalid_grant' });
    expect(await ctx.harness.sessions.countDocuments()).toBe(0);
  });
});
