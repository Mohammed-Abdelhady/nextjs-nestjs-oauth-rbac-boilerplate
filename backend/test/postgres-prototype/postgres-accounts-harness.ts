import { randomUUID } from 'node:crypto';
import { Kysely } from 'kysely';
import { SessionRevoker } from '../../src/session/revocation/session-revoker';
import { RevokerAccountSessions } from '../../src/user/stores/revoker-account-sessions';
import { FrozenClock, TEST_NOW } from '../utils/frozen-clock';
import {
  issueOnlyTheRefusedEventId,
  REFUSED_EVENT_ID,
  REFUSED_EVENT_SEED_ACTION,
  REFUSED_EVENT_SEED_OUTCOME,
} from '../utils/refused-event';
import { AccountsContractHarness } from '../utils/user/accounts-contract/accounts-contract-harness';
import { PostgresAccountPermissionStore } from './adapter/postgres-account-permission.store';
import { PostgresAccountProfileStore } from './adapter/postgres-account-profile.store';
import {
  PostgresActivationAccounts,
  PostgresActivationSignIn,
} from './adapter/postgres-activation-accounts';
import { PostgresAdminAccountStore } from './adapter/postgres-admin-account.store';
import { PrototypeDatabase } from './adapter/postgres-database';
import { PostgresMailCounterStore } from './adapter/postgres-mail-counter.store';
import { PostgresPendingRegistrationStore } from './adapter/postgres-pending-registration.store';
import { PostgresRoleCatalogStore } from './adapter/postgres-role-catalog.store';
import { PostgresRoleChangeStore } from './adapter/postgres-role-change.store';
import { PostgresRoleSweepStore } from './adapter/postgres-role-sweep.store';
import { PostgresSecurityEventStore } from './adapter/postgres-security-event.store';
import { PostgresSessionRevocationStore } from './adapter/postgres-session-revocation.store';
import { PostgresUnitOfWorkRunner } from './adapter/postgres-unit-of-work';
import { openPrototypeConnection } from './postgres-connection';

const AN_OBJECT_ID = '65f000000000000000000001';
const TWO_HOURS_MS = 7_200_000;
const TEN_MINUTES_MS = 600_000;

export interface PostgresAccountsHarness extends AccountsContractHarness {
  readonly database: Kysely<PrototypeDatabase>;
}

export async function bootPostgresAccountsHarness(): Promise<PostgresAccountsHarness> {
  const connection = await openPrototypeConnection();
  const { database } = connection;
  const clock = new FrozenClock(TEST_NOW);
  const events = new PostgresSecurityEventStore(database);

  return {
    database,
    clock,
    profiles: new PostgresAccountProfileStore(database, clock),
    permissions: new PostgresAccountPermissionStore(database, clock),
    sessions: new RevokerAccountSessions(
      new SessionRevoker(
        new PostgresUnitOfWorkRunner(database),
        new PostgresSessionRevocationStore(clock, events),
        clock,
      ),
    ),
    admin: new PostgresAdminAccountStore(database, clock),
    activation: new PostgresActivationAccounts(database, clock),
    signIn: new PostgresActivationSignIn(),
    roleCatalog: new PostgresRoleCatalogStore(database),
    roleChanges: new PostgresRoleChangeStore(clock, events),
    roleSweeps: new PostgresRoleSweepStore(database, clock),
    registrations: new PostgresPendingRegistrationStore(database),
    mailCounters: new PostgresMailCounterStore(database),
    runner: (pause) => new PostgresUnitOfWorkRunner(database, pause),

    seedRole: async (role) => {
      const at = clock.now();
      const row = await database
        .insertInto('roles')
        .values({
          name: role.name,
          slug: role.slug,
          level: role.level ?? null,
          permissions: role.permissions,
          created_at: at,
          updated_at: at,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    },
    seedAccount: async (account) => {
      const row = await database
        .insertInto('users')
        .values({
          email: account.email,
          name: account.name ?? 'Contract Tester',
          role: account.role,
          permissions: account.permissions ?? [],
          password_hash: account.passwordHash ?? null,
          is_verified: account.verified ?? true,
          is_deleted: account.deleted ?? false,
          address_generation: account.addressGeneration ?? 0,
          auth_provider: 'email',
          created_at: account.createdAt ?? clock.now(),
          updated_at: account.createdAt ?? clock.now(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    },
    seedSession: async (userId) => {
      const now = clock.now();
      const account = await database
        .selectFrom('users')
        .select('session_version')
        .where('id', '=', userId)
        .executeTakeFirstOrThrow();
      const row = await database
        .insertInto('sessions')
        .values({
          user_id: userId,
          token_hash: Buffer.from(randomUUID()),
          user_agent: 'Contract/1',
          device: null,
          ip: '127.0.0.1',
          client_id: 'web',
          user_version: account.session_version,
          client_version: 0,
          grant_version: 0,
          auth_epoch: 1,
          schema_version: 1,
          scopes: ['api'],
          audience: 'api',
          authentication_methods: [],
          credential_purpose: 'browser_session',
          browser_generation: 1,
          authenticated_at: now,
          last_used_at: now,
          last_activity_at: now,
          expires_at: new Date(now.getTime() + TWO_HOURS_MS),
          idle_expires_at: new Date(now.getTime() + TEN_MINUTES_MS),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return row.id;
    },
    alterAccount: async (userId, change) => {
      await database
        .updateTable('users')
        .set({
          ...(change.role === undefined ? {} : { role: change.role }),
          ...(change.deleted === undefined
            ? {}
            : { is_deleted: change.deleted }),
          ...(change.email === undefined ? {} : { email: change.email }),
          ...(change.verified === undefined
            ? {}
            : { is_verified: change.verified }),
        })
        .where('id', '=', userId)
        .execute();
    },
    removeRole: async (slug) => {
      await database.deleteFrom('roles').where('slug', '=', slug).execute();
    },

    account: async (userId) => {
      const row = await database
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirst();
      if (!row) return null;
      return {
        email: row.email ?? '',
        name: row.name ?? '',
        role: row.role,
        permissions: row.permissions,
        passwordHash: row.password_hash,
        isVerified: row.is_verified,
        isDeleted: row.is_deleted,
        deletedAt: row.deleted_at,
        sessionVersion: row.session_version,
        addressGeneration: row.address_generation,
        authProvider: row.auth_provider,
        primaryProvider: row.primary_provider,
      };
    },
    accountIdByEmail: async (email) => {
      const row = await database
        .selectFrom('users')
        .select('id')
        .where('email', '=', email)
        .executeTakeFirst();
      return row?.id ?? null;
    },
    liveSessionIds: async (userId) => {
      const rows = await database
        .selectFrom('sessions')
        .innerJoin('users', 'users.id', 'sessions.user_id')
        .select('sessions.id')
        .where('sessions.user_id', '=', userId)
        .where('sessions.is_valid', '=', true)
        .where('sessions.revoked_at', 'is', null)
        .whereRef('sessions.user_version', '=', 'users.session_version')
        .execute();
      return rows.map((row) => row.id).sort();
    },
    events: async () => {
      const rows = await database
        .selectFrom('security_events')
        .selectAll()
        .where('action', '!=', REFUSED_EVENT_SEED_ACTION)
        .execute();
      return rows.map((row) => ({
        targetUserId: row.target_user_id,
        actorId: row.actor_id,
        sessionId: row.session_id,
        action: row.action,
        reasonCode: row.reason_code,
        assignedRoleId: row.assigned_role_id,
        previousRoleId: row.previous_role_id,
        assignmentSessionVersion: row.assignment_session_version,
      }));
    },
    pendingRegistrations: async (email) => {
      const row = await database
        .selectFrom('pending_registrations')
        .select((select) => select.fn.countAll<string>().as('rows'))
        .where('email', '=', email)
        .executeTakeFirstOrThrow();
      return Number(row.rows);
    },

    absentId: () => randomUUID(),
    foreignId: () => AN_OBJECT_ID,

    refuseSecurityEvents: async () => {
      await database
        .insertInto('security_events')
        .values({
          event_id: REFUSED_EVENT_ID,
          action: REFUSED_EVENT_SEED_ACTION,
          outcome: REFUSED_EVENT_SEED_OUTCOME,
          occurred_at: TEST_NOW,
        })
        .onConflict((conflict) => conflict.column('event_id').doNothing())
        .execute();
      return issueOnlyTheRefusedEventId();
    },

    reset: connection.reset,
    close: connection.close,
  };
}
