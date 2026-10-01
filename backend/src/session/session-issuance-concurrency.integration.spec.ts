import { Connection } from 'mongoose';
import { WEB_CLIENT_ID } from './constants/client-ids';
import {
  WEB_ABSOLUTE_LIFETIME_MS,
  WEB_IDLE_LIFETIME_MS,
} from './constants/session-policy';
import { startMemoryReplSet } from '../../test/utils/memory-replset';
import {
  bootSessionAuthority,
  createTestUser,
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SessionAuthorityHarness,
} from '../../test/utils/session-authority-harness';
import { FrozenClock, TEST_NOW } from '../../test/utils/frozen-clock';

describe('session issuance concurrency', () => {
  let mongo: Awaited<ReturnType<typeof startMemoryReplSet>>;
  let harness: SessionAuthorityHarness;

  beforeAll(async () => {
    mongo = await startMemoryReplSet();
    harness = await bootSessionAuthority(
      mongo.uri('session_issuance_concurrency'),
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

  it('issues sessions for 25 different users concurrently', async () => {
    const users = await Promise.all(
      Array.from({ length: 25 }, (_, index) =>
        createTestUser(harness.users, `parallel-${index}@example.test`),
      ),
    );
    const outcomes = await Promise.allSettled(
      users.map((user) =>
        harness.sessionService.createSession(
          user._id,
          'parallel login',
          '127.0.0.1',
        ),
      ),
    );

    expect({
      fulfilled: outcomes.filter((outcome) => outcome.status === 'fulfilled')
        .length,
      persisted: await harness.sessions.countDocuments({ isValid: true }),
    }).toEqual({ fulfilled: 25, persisted: 25 });
  });

  it('rejects a session committed after a concurrent application disable', async () => {
    const user = await createTestUser(
      harness.users,
      'disable-race@example.test',
    );
    const gate = pauseFirstTransactionCommit(harness.connection);
    const issue = harness.sessionService.createSession(
      user._id,
      'disable race',
      '127.0.0.1',
    );
    await gate.reached;

    let applicationWasDisabledAndEnabled = false;
    try {
      await harness.applicationAccess.disableApplication(WEB_CLIENT_ID);
      await harness.applicationAccess.enableApplication(WEB_CLIENT_ID);
      applicationWasDisabledAndEnabled = true;
    } catch {
      applicationWasDisabledAndEnabled = false;
    } finally {
      gate.release();
      gate.restore();
    }

    const outcome = await Promise.allSettled([issue]);
    const token = outcome[0];
    const validation =
      token.status === 'fulfilled'
        ? await harness.authority.validate(token.value, { extendIdle: false })
        : undefined;

    expect({
      applicationWasDisabledAndEnabled,
      issued: token.status === 'fulfilled',
      validation,
    }).toEqual({
      applicationWasDisabledAndEnabled: true,
      issued: true,
      validation: null,
    });
  });
});

function pauseFirstTransactionCommit(connection: Connection) {
  let announceReached = () => {};
  let releaseCommit = () => {};
  const reached = new Promise<void>((resolve) => {
    announceReached = resolve;
  });
  const blocked = new Promise<void>((resolve) => {
    releaseCommit = resolve;
  });
  const originalStartSession = connection.startSession.bind(connection);
  const startSession = jest.spyOn(connection, 'startSession');
  let pauseNextCommit = true;

  startSession.mockImplementation(async (options) => {
    const session = await originalStartSession(options);
    if (pauseNextCommit) {
      pauseNextCommit = false;
      const originalCommit = session.commitTransaction.bind(session);
      // Hold the real transaction after it captures the application version.
      jest.spyOn(session, 'commitTransaction').mockImplementation(async () => {
        announceReached();
        await blocked;
        return originalCommit();
      });
    }
    return session;
  });

  return {
    reached,
    release: releaseCommit,
    restore: () => startSession.mockRestore(),
  };
}
