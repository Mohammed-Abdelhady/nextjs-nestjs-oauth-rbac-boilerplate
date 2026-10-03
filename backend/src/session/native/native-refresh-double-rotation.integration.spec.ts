import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import { OAUTH_ERROR, TokenSuccess, OauthFailure } from './native-oauth.types';
import {
  NATIVE_CLIENT_ID,
  NATIVE_META,
  NativeOauthHarness,
  issueNativeGrant,
  resetNativeClient,
  startNativeOauth,
  stopNativeOauth,
} from './native-oauth.harness-spec';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../test/utils/session-authority-harness';
import { RaceBarrier, pauseQuery } from '../../../test/utils/race-gate';

describe('native refresh double rotation race', () => {
  let ctx: NativeOauthHarness;

  beforeAll(async () => {
    ctx = await startNativeOauth('native_refresh_double_rotation');
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
    'admits one rotation and replays the other when both read the token unspent',
    async () => {
      const granted = await issueNativeGrant(ctx);
      const barrier = new RaceBarrier();
      const spend = barrier.point('refresh-spend');
      const updateOne = ctx.credentials.updateOne.bind(ctx.credentials);
      const spy = jest
        .spyOn(ctx.credentials, 'updateOne')
        .mockImplementation((...args) => {
          const query = updateOne(...args);
          pauseQuery(query, spend);
          return query;
        });

      let results: Array<TokenSuccess | OauthFailure> | undefined;
      try {
        const first = rotate(ctx, granted.refreshToken);
        const second = rotate(ctx, granted.refreshToken);
        await spend.reached(2);
        spend.release();
        results = await Promise.all([first, second]);
      } finally {
        spend.release();
        spy.mockRestore();
      }
      if (!results) {
        throw new Error('double rotation race did not run');
      }

      const successes = results.filter((result) => result.ok);
      const failures = results.filter((result) => !result.ok);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(failures[0]).toMatchObject({ error: OAUTH_ERROR.INVALID_GRANT });

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

      expect({
        sessionValid: session.isValid,
        revokedReason: session.revokedReason,
        credentialCount: credentials.length,
        spentCount: credentials.filter((row) => row.spent).length,
        revokedCount: credentials.filter((row) => row.revokedAt instanceof Date)
          .length,
        unspentCount: credentials.filter((row) => !row.spent).length,
      }).toEqual({
        sessionValid: false,
        revokedReason: SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
        credentialCount: 4,
        spentCount: 4,
        revokedCount: 4,
        unspentCount: 0,
      });
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );

  it(
    'rejects the loser by retrying its transaction into the replay branch',
    async () => {
      const granted = await issueNativeGrant(ctx);
      let reads = 0;
      const findOne = ctx.credentials.findOne.bind(ctx.credentials);
      const readSpy = jest
        .spyOn(ctx.credentials, 'findOne')
        .mockImplementation((...args) => {
          reads += 1;
          return findOne(...args);
        });
      const barrier = new RaceBarrier();
      const spend = barrier.point('refresh-spend');
      const updateOne = ctx.credentials.updateOne.bind(ctx.credentials);
      const spendSpy = jest
        .spyOn(ctx.credentials, 'updateOne')
        .mockImplementation((...args) => {
          const query = updateOne(...args);
          pauseQuery(query, spend);
          return query;
        });

      let results: Array<TokenSuccess | OauthFailure> | undefined;
      try {
        const first = rotate(ctx, granted.refreshToken);
        const second = rotate(ctx, granted.refreshToken);
        await spend.reached(2);
        spend.release();
        results = await Promise.all([first, second]);
      } finally {
        spend.release();
        spendSpy.mockRestore();
        readSpy.mockRestore();
      }
      if (!results) {
        throw new Error('double rotation race did not run');
      }

      // The loser's write conflicts, withMajorityTransaction restarts the work,
      // the token then reads spent and the replay branch revokes the family.
      expect(results.filter((result) => result.ok)).toHaveLength(1);
      expect(results.find((result) => !result.ok)).toMatchObject({
        error: OAUTH_ERROR.INVALID_GRANT,
      });
      expect(reads).toBeGreaterThan(2);

      const session = await ctx.harness.sessions.findOne({
        clientId: NATIVE_CLIENT_ID,
      });
      expect(session?.revokedReason).toBe(
        SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
      );
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );
});

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
