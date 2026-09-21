import { Model, Types } from 'mongoose';
import { getModelToken } from '@nestjs/mongoose';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/enums/error-code.enum';
import { CREDENTIAL_PURPOSE } from './constants/credential-purpose';
import { WEB_CLIENT_ID } from './constants/client-ids';
import { SECURITY_EVENT_ACTION } from './constants/security-event-action';
import {
  MAX_SESSIONS_PER_USER,
  WEB_ABSOLUTE_LIFETIME_MS,
  WEB_IDLE_LIFETIME_MS,
} from './constants/session-policy';
import { hashToken } from './utils/token-hash';
import {
  SecurityEvent,
  SecurityEventDocument,
} from './schemas/security-event.schema';
import { startMemoryReplSet } from '../../test/utils/memory-replset';
import { FrozenClock, TEST_NOW } from '../../test/utils/frozen-clock';
import {
  bootSessionAuthority,
  createTestUser,
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SessionAuthorityHarness,
} from '../../test/utils/session-authority-harness';

describe('session authority (plan 02)', () => {
  let mongo: Awaited<ReturnType<typeof startMemoryReplSet>>;
  let harness: SessionAuthorityHarness;

  beforeAll(async () => {
    mongo = await startMemoryReplSet();
    harness = await bootSessionAuthority(
      mongo.uri('session_authority'),
      new FrozenClock(TEST_NOW),
    );
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    if (harness) {
      await harness.app.close();
    }
    if (mongo) {
      await mongo.stop();
    }
  });

  beforeEach(async () => {
    harness.clock.set(TEST_NOW);
    await harness.sessions.deleteMany({});
    await harness.grants.deleteMany({});
    await harness.users.deleteMany({});
    await harness.applications.updateMany(
      { clientId: WEB_CLIENT_ID, environment: 'test' },
      {
        $set: {
          enabled: true,
          sessionVersion: 0,
          'policy.absoluteLifetimeMs': WEB_ABSOLUTE_LIFETIME_MS,
          'policy.idleLifetimeMs': WEB_IDLE_LIFETIME_MS,
        },
      },
    );
  });

  async function login(email: string): Promise<{
    userId: Types.ObjectId;
    token: string;
  }> {
    const user = await createTestUser(harness.users, email);
    try {
      const token = await harness.sessionService.createSession(
        user._id,
        'Mozilla/5.0',
        '127.0.0.1',
      );
      return { userId: user._id, token };
    } catch (error) {
      if (error instanceof AppException) {
        throw new Error(
          `${error.message} ${JSON.stringify(error.getDetails() ?? {})}`,
          { cause: error },
        );
      }
      throw error;
    }
  }

  it('stores a hash and authenticates the raw secret', async () => {
    const { token } = await login('hash@example.test');
    const stored = await harness.sessions.findOne({
      tokenHash: hashToken(token),
    });
    expect(stored).not.toBeNull();
    expect(stored?.tokenHash).toBe(hashToken(token));
    expect(await harness.sessionService.validateSession(token)).not.toBeNull();
  });

  it('rejects a missing credential and a wrong purpose', async () => {
    expect(await harness.sessionService.validateSession('')).toBeNull();
    const { token } = await login('purpose@example.test');
    await harness.sessions.updateOne(
      { tokenHash: hashToken(token) },
      { $set: { credentialPurpose: CREDENTIAL_PURPOSE.NATIVE_REFRESH } },
    );
    expect(await harness.sessionService.validateSession(token)).toBeNull();
  });

  it('fails at the idle deadline while the document still exists', async () => {
    const { token } = await login('idle@example.test');
    const stored = await harness.sessions.findOne({
      tokenHash: hashToken(token),
    });
    if (!stored) {
      throw new Error('expected session');
    }
    harness.clock.set(new Date(stored.idleExpiresAt.getTime() - 1));
    expect(
      await harness.authority.validate(token, { extendIdle: false }),
    ).not.toBeNull();
    harness.clock.set(stored.idleExpiresAt);
    expect(
      await harness.authority.validate(token, { extendIdle: false }),
    ).toBeNull();
    expect(
      await harness.sessions.findById(stored._id).then((row) => row?.isValid),
    ).toBe(true);
  });

  it('fails at the absolute deadline', async () => {
    const { token } = await login('absolute@example.test');
    const stored = await harness.sessions.findOne({
      tokenHash: hashToken(token),
    });
    if (!stored) {
      throw new Error('expected session');
    }
    const almost = new Date(stored.expiresAt.getTime() - 1);
    await harness.sessions.updateOne(
      { _id: stored._id },
      {
        $set: {
          idleExpiresAt: stored.expiresAt,
          lastActivityAt: almost,
        },
      },
    );
    harness.clock.set(almost);
    expect(
      await harness.authority.validate(token, { extendIdle: false }),
    ).not.toBeNull();
    harness.clock.set(stored.expiresAt);
    expect(
      await harness.authority.validate(token, { extendIdle: false }),
    ).toBeNull();
  });

  it('applies a tighter policy without extending a relaxed one', async () => {
    const { token } = await login('policy@example.test');
    await harness.applications.updateOne(
      { clientId: WEB_CLIENT_ID, environment: 'test' },
      { $set: { 'policy.idleLifetimeMs': 1 } },
    );
    harness.clock.advance(2);
    expect(await harness.sessionService.validateSession(token)).toBeNull();

    await harness.applications.updateOne(
      { clientId: WEB_CLIENT_ID, environment: 'test' },
      { $set: { 'policy.idleLifetimeMs': WEB_IDLE_LIFETIME_MS * 2 } },
    );
    const second = await login('relax@example.test');
    const stored = await harness.sessions.findOne({
      tokenHash: hashToken(second.token),
    });
    if (!stored) {
      throw new Error('expected session');
    }
    harness.clock.set(stored.idleExpiresAt);
    expect(
      await harness.sessionService.validateSession(second.token),
    ).toBeNull();
  });

  it('refuses a 21st session when two logins race at the cap', async () => {
    const user = await createTestUser(harness.users, 'limit@example.test');
    for (let index = 0; index < MAX_SESSIONS_PER_USER - 1; index += 1) {
      await harness.sessionService.createSession(
        user._id,
        `agent-${index}`,
        '127.0.0.1',
      );
    }
    const attempts = await Promise.allSettled([
      harness.sessionService.createSession(user._id, 'race-a', '127.0.0.1'),
      harness.sessionService.createSession(user._id, 'race-b', '127.0.0.1'),
    ]);
    const accepted = attempts.filter((result) => result.status === 'fulfilled');
    const rejected = attempts.filter((result) => result.status === 'rejected');
    expect(accepted.length).toBe(1);
    expect(rejected.length).toBe(1);
    const failure = rejected[0];
    if (
      failure.status !== 'rejected' ||
      !(failure.reason instanceof AppException)
    ) {
      throw new Error('expected SESSION_LIMIT_REACHED');
    }
    expect(failure.reason.getCode()).toBe(ErrorCode.SESSION_LIMIT_REACHED);
    expect(
      await harness.sessions.countDocuments({
        user: user._id,
        isValid: true,
        userVersion: 0,
      }),
    ).toBe(MAX_SESSIONS_PER_USER);
  });

  it('revokes the current session and leaves others until all-other logout', async () => {
    const first = await login('one@example.test');
    const secondToken = await harness.sessionService.createSession(
      first.userId,
      'second',
      '127.0.0.1',
    );
    expect(await harness.sessionService.invalidateSession(first.token)).toBe(
      true,
    );
    expect(
      await harness.sessionService.validateSession(first.token),
    ).toBeNull();
    expect(
      await harness.sessionService.validateSession(secondToken),
    ).not.toBeNull();

    const remaining = await harness.sessionService.invalidateAllSessionsExcept(
      first.userId,
      secondToken,
    );
    expect(remaining).toBe(0);
    expect(
      await harness.sessionService.validateSession(secondToken),
    ).not.toBeNull();
  });

  it('applies concurrent revokes once and keeps the selected session valid', async () => {
    const kept = await login('concurrent-revoke@example.test');
    const targetedTokens = await Promise.all(
      ['target one', 'target two'].map(async (agent) => {
        const issued = await harness.sessionService.createSession(
          kept.userId,
          agent,
          '127.0.0.1',
        );
        return issued.sessionToken;
      }),
    );
    await Promise.allSettled([
      ...targetedTokens.map((token) =>
        harness.sessionService.invalidateSession(token),
      ),
      harness.sessionService.invalidateAllSessionsExcept(
        kept.userId,
        kept.token,
      ),
    ]);
    const sessions = await harness.sessions.find({ user: kept.userId }).lean();
    const persisted = [...targetedTokens, kept.token].map((token) => {
      const session = sessions.find(
        (row) => row.tokenHash === hashToken(token),
      );
      return {
        id: session?._id.toString(),
        state: [session?.isValid, Boolean(session?.revokedAt)],
      };
    });
    const events = await harness.app
      .get<Model<SecurityEventDocument>>(getModelToken(SecurityEvent.name))
      .find({
        targetUserId: kept.userId.toString(),
        action: {
          $in: [
            SECURITY_EVENT_ACTION.SESSION_REVOKED,
            SECURITY_EVENT_ACTION.SESSIONS_REVOKED_OTHERS,
          ],
        },
      })
      .lean();
    const expectedEvents = [
      [SECURITY_EVENT_ACTION.SESSION_REVOKED, persisted[0]?.id],
      [SECURITY_EVENT_ACTION.SESSION_REVOKED, persisted[1]?.id],
      [SECURITY_EVENT_ACTION.SESSIONS_REVOKED_OTHERS, persisted[2]?.id],
    ]
      .map(([action, sessionId]) => action + ':' + sessionId)
      .sort();

    expect({
      sessionState: persisted.map(({ state }) => state),
      securityEvents: events
        .map(({ action, sessionId }) => action + ':' + sessionId)
        .sort(),
    }).toEqual({
      sessionState: [
        [false, true],
        [false, true],
        [true, false],
      ],
      securityEvents: expectedEvents,
    });
  });

  it('does not let a revoked caller promote itself during all-other logout', async () => {
    const first = await login('survivor@example.test');
    const other = await harness.sessionService.createSession(
      first.userId,
      'other',
      '127.0.0.1',
    );
    await harness.sessionService.invalidateAllSessionsExcept(
      first.userId,
      first.token,
    );
    await expect(
      harness.sessionService.invalidateAllSessionsExcept(first.userId, other),
    ).rejects.toMatchObject({ code: ErrorCode.SESSION_INVALID });
    expect(
      await harness.sessionService.validateSession(first.token),
    ).not.toBeNull();
    expect(await harness.sessionService.validateSession(other)).toBeNull();
  });

  it('keeps old sessions invalid after an application is re-enabled', async () => {
    const { token } = await login('app@example.test');
    await harness.applicationAccess.disableApplication(WEB_CLIENT_ID);
    expect(await harness.sessionService.validateSession(token)).toBeNull();
    await harness.applicationAccess.enableApplication(WEB_CLIENT_ID);
    expect(await harness.sessionService.validateSession(token)).toBeNull();
  });

  it('blocks a grant so existing and new sessions fail', async () => {
    const { userId, token } = await login('grant@example.test');
    await harness.applicationAccess.blockGrant(userId, WEB_CLIENT_ID);
    expect(await harness.sessionService.validateSession(token)).toBeNull();
    await expect(
      harness.sessionService.createSession(userId, 'retry', '127.0.0.1'),
    ).rejects.toMatchObject({ code: ErrorCode.GRANT_BLOCKED });
  });
});
