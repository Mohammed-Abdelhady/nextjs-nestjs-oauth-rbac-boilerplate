import { WEB_CLIENT_ID } from './constants/client-ids';
import {
  WEB_ABSOLUTE_LIFETIME_MS,
  WEB_IDLE_LIFETIME_MS,
} from './constants/session-policy';
import { ApplicationRegistryService } from './services/application-registry.service';
import { hashToken } from './utils/token-hash';
import { SESSION_LAST_USED_UPDATE_INTERVAL_MS } from '../common/constants/session';
import { startMemoryReplSet } from '../../test/utils/memory-replset';
import { FrozenClock, TEST_NOW } from '../../test/utils/frozen-clock';
import {
  bootSessionAuthority,
  createTestUser,
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
  SessionAuthorityHarness,
} from '../../test/utils/session-authority-harness';
import { RaceBarrier } from '../../test/utils/race-gate';

describe('idle extension against revocation race', () => {
  let mongo: Awaited<ReturnType<typeof startMemoryReplSet>>;
  let harness: SessionAuthorityHarness;

  beforeAll(async () => {
    mongo = await startMemoryReplSet();
    harness = await bootSessionAuthority(
      mongo.uri('idle_extension_revocation'),
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
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

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

  it(
    'does not revive a session revoked while the extension is paused',
    async () => {
      const issued = await login('extension-race@example.test');
      const before = await harness.sessions.findOne({
        tokenHash: hashToken(issued.token),
      });
      if (!before) {
        throw new Error('expected a session');
      }
      // Move past the last-used update interval so the extension really writes.
      harness.clock.set(
        new Date(
          TEST_NOW.getTime() + SESSION_LAST_USED_UPDATE_INTERVAL_MS + 60_000,
        ),
      );

      const applications = harness.app.get(ApplicationRegistryService);
      const findByClientId = applications.findByClientId.bind(applications);
      const barrier = new RaceBarrier();
      const read = barrier.point('authority-read');
      const spy = jest
        .spyOn(applications, 'findByClientId')
        .mockImplementation(async (clientId) => {
          await read.hold();
          return findByClientId(clientId);
        });

      let validation: Promise<unknown> | undefined;
      try {
        validation = harness.authority.validate(issued.token, {
          extendIdle: true,
        });
        await read.reached(1);
        await harness.revocation.revokeByToken(issued.token);
        read.release();
        // Accepted boundary: a validation that began before the revocation completed may return its pre-revocation read; the next validation must not.
        await validation;
      } finally {
        read.release();
        spy.mockRestore();
      }

      const after = await harness.sessions.findById(before._id);
      expect({
        sessionValid: after?.isValid,
        revoked: after?.revokedAt instanceof Date,
        idleExpiresAt: after?.idleExpiresAt.getTime(),
        lastActivityAt: after?.lastActivityAt.getTime(),
        validationAfterRevocation: await harness.authority.validate(
          issued.token,
          {
            extendIdle: false,
          },
        ),
      }).toEqual({
        sessionValid: false,
        revoked: true,
        idleExpiresAt: before.idleExpiresAt.getTime(),
        lastActivityAt: before.lastActivityAt.getTime(),
        validationAfterRevocation: null,
      });
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );

  it(
    'refuses to extend or validate a session revoked before the validation',
    async () => {
      const issued = await login('revoked-first@example.test');
      const before = await harness.sessions.findOne({
        tokenHash: hashToken(issued.token),
      });
      if (!before) {
        throw new Error('expected a session');
      }
      harness.clock.set(
        new Date(
          TEST_NOW.getTime() + SESSION_LAST_USED_UPDATE_INTERVAL_MS + 60_000,
        ),
      );

      await harness.revocation.revokeByToken(issued.token);
      const validation = await harness.authority.validate(issued.token, {
        extendIdle: true,
      });
      const after = await harness.sessions.findById(before._id);

      expect({
        validation,
        sessionValid: after?.isValid,
        idleExpiresAt: after?.idleExpiresAt.getTime(),
        lastActivityAt: after?.lastActivityAt.getTime(),
      }).toEqual({
        validation: null,
        sessionValid: false,
        idleExpiresAt: before.idleExpiresAt.getTime(),
        lastActivityAt: before.lastActivityAt.getTime(),
      });
    },
    SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  );

  async function login(email: string): Promise<{ token: string }> {
    const user = await createTestUser(harness.users, email);
    const issued = await harness.sessionService.createSession(
      user._id,
      'Mozilla/5.0',
      '127.0.0.1',
    );
    return { token: issued.sessionToken };
  }
});
