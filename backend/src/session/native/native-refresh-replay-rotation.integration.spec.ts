import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import { NativeCredentialIssuer } from './native-credential.issuer';
import { OAUTH_ERROR, TokenSuccess, OauthFailure } from './native-oauth.types';
import {
  NATIVE_CLIENT_ID,
  NATIVE_META,
  NativeOauthHarness,
  issueNativeGrant,
  resetNativeClient,
  startNativeOauth,
  stopNativeOauth,
} from './native-oauth.fixture';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../test/utils/session-authority-harness';
import { RaceBarrier, pauseQuery } from '../../../test/utils/race-gate';

describe('native refresh replay against rotation race', () => {
  let ctx: NativeOauthHarness;

  beforeAll(async () => {
    ctx = await startNativeOauth('native_refresh_replay_rotation');
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    if (ctx) {
      await stopNativeOauth(ctx);
    }
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    await resetNativeClient(ctx);
  });

  it(
    'revokes the family when the replay commits before the paused rotation spends',
    async () => {
      const granted = await issueNativeGrant(ctx);
      const successor = await rotate(ctx, granted.refreshToken);
      if (!successor.ok) {
        throw new Error('setup rotation failed');
      }

      const barrier = new RaceBarrier();
      const spend = barrier.point('successor-spend');
      const updateOne = ctx.credentials.updateOne.bind(ctx.credentials);
      const spendSpy = jest
        .spyOn(ctx.credentials, 'updateOne')
        .mockImplementation((...args) => {
          const query = updateOne(...args);
          pauseQuery(query, spend);
          return query;
        });

      let rotation: TokenSuccess | OauthFailure | undefined;
      let replay: TokenSuccess | OauthFailure | undefined;
      try {
        const paused = rotate(ctx, successor.refreshToken);
        await spend.reached(1);
        replay = await rotate(ctx, granted.refreshToken);
        spend.release();
        rotation = await paused;
      } finally {
        spend.release();
        spendSpy.mockRestore();
      }
      if (!rotation || !replay) {
        throw new Error('replay race did not run');
      }

      expect(replay).toMatchObject({
        ok: false,
        error: OAUTH_ERROR.INVALID_GRANT,
      });
      expect(rotation).toMatchObject({
        ok: false,
        error: OAUTH_ERROR.INVALID_GRANT,
      });
      expect(await familyState(ctx)).toEqual({
        sessionValid: false,
        revokedReason: SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
        credentialCount: 4,
        unspentCount: 0,
        unrevokedCount: 0,
      });
      expect(await rotate(ctx, successor.refreshToken)).toMatchObject({
        ok: false,
        error: OAUTH_ERROR.INVALID_GRANT,
      });
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );

  it(
    'revokes the family when the successor rotation commits before the paused replay',
    async () => {
      const granted = await issueNativeGrant(ctx);
      const successor = await rotate(ctx, granted.refreshToken);
      if (!successor.ok) {
        throw new Error('setup rotation failed');
      }

      const issuer = ctx.harness.app.get(NativeCredentialIssuer);
      const revokeFamily = issuer.revokeFamily.bind(issuer);
      const barrier = new RaceBarrier();
      const replayRevoke = barrier.point('replay-revoke');
      const replaySpy = jest
        .spyOn(issuer, 'revokeFamily')
        .mockImplementation(async (...args) => {
          await replayRevoke.hold();
          return revokeFamily(...args);
        });

      let rotation: TokenSuccess | OauthFailure | undefined;
      let replay: TokenSuccess | OauthFailure | undefined;
      try {
        const pausedReplay = rotate(ctx, granted.refreshToken);
        await replayRevoke.reached(1);
        rotation = await rotate(ctx, successor.refreshToken);
        replayRevoke.release();
        replay = await pausedReplay;
      } finally {
        replayRevoke.release();
        replaySpy.mockRestore();
      }
      if (!rotation || !replay) {
        throw new Error('replay race did not run');
      }

      expect(rotation.ok).toBe(true);
      if (!rotation.ok) {
        throw new Error('successor rotation did not succeed');
      }
      expect(replay).toMatchObject({
        ok: false,
        error: OAUTH_ERROR.INVALID_GRANT,
      });
      expect(await familyState(ctx)).toEqual({
        sessionValid: false,
        revokedReason: SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
        credentialCount: 6,
        unspentCount: 0,
        unrevokedCount: 0,
      });
      expect(await rotate(ctx, rotation.refreshToken)).toMatchObject({
        ok: false,
        error: OAUTH_ERROR.INVALID_GRANT,
      });
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );
});

async function familyState(ctx: NativeOauthHarness) {
  const session = await ctx.harness.sessions.findOne({
    clientId: NATIVE_CLIENT_ID,
  });
  if (!session) {
    throw new Error('expected a native session');
  }
  const credentials = await ctx.credentials
    .find({ sessionId: session._id })
    .lean()
    .exec();
  return {
    sessionValid: session.isValid,
    revokedReason: session.revokedReason,
    credentialCount: credentials.length,
    unspentCount: credentials.filter((row) => !row.spent).length,
    unrevokedCount: credentials.filter(
      (row) => !(row.revokedAt instanceof Date),
    ).length,
  };
}

function rotate(
  ctx: NativeOauthHarness,
  refreshToken: string,
): Promise<TokenSuccess | OauthFailure> {
  return ctx.tokens.grant(
    {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: NATIVE_CLIENT_ID,
    },
    NATIVE_META,
  );
}
