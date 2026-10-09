import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { AuthEpochService } from '../../src/common/services/auth-epoch.service';
import { SessionValidator } from '../../src/session/authority/session-validator';
import { SessionRevoker } from '../../src/session/revocation/session-revoker';
import { REFUSED_EVENT_SEED_ACTION } from '../utils/refused-event';
import {
  ACCOUNT_TAKEN_AT,
  AuthorityContractHarness,
} from '../utils/session/authority-contract/authority-contract-harness';
import {
  CONTRACT_AUTH_EPOCH,
  CONTRACT_ENVIRONMENT,
} from '../utils/session/issuance-contract/issuance-contract-harness';
import { PostgresAuthorityApplications } from './adapter/postgres-authority-applications';
import { PostgresSecurityEventStore } from './adapter/postgres-security-event.store';
import { PostgresSessionAuthorityStore } from './adapter/postgres-session-authority.store';
import { PostgresSessionRevocationStore } from './adapter/postgres-session-revocation.store';
import { PostgresUnitOfWorkRunner } from './adapter/postgres-unit-of-work';
import { bootPostgresIssuanceHarness } from './postgres-issuance-harness';

const AN_OBJECT_ID = '65f000000000000000000001';

export async function bootPostgresAuthorityHarness(): Promise<AuthorityContractHarness> {
  const issuance = await bootPostgresIssuanceHarness();
  const { database, clock } = issuance;
  const authorityStore = new PostgresSessionAuthorityStore(database);
  const authorityApplications = new PostgresAuthorityApplications(
    database,
    CONTRACT_ENVIRONMENT,
  );
  const revocationStore = new PostgresSessionRevocationStore(
    clock,
    new PostgresSecurityEventStore(database),
  );
  const authEpoch = new AuthEpochService(
    new ConfigService({
      auth: { epoch: CONTRACT_AUTH_EPOCH, nativeEnabled: false },
      server: { nodeEnv: CONTRACT_ENVIRONMENT },
    }),
  );

  return {
    issuance,
    accountTakenAt: ACCOUNT_TAKEN_AT.FIRST_READ,
    authorityStore,
    authorityApplications,
    revocationStore,
    validator: () =>
      new SessionValidator(
        authorityStore,
        authorityApplications,
        clock,
        authEpoch,
      ),
    revoker: (pause) =>
      new SessionRevoker(
        new PostgresUnitOfWorkRunner(database, pause),
        revocationStore,
        clock,
      ),

    session: async (sessionId) => {
      const row = await database
        .selectFrom('sessions')
        .selectAll()
        .where('id', '=', sessionId)
        .executeTakeFirst();
      return row
        ? {
            isValid: row.is_valid,
            revokedAt: row.revoked_at,
            revokedReason: row.revoked_reason,
            userVersion: row.user_version,
            idleExpiresAt: row.idle_expires_at,
            lastActivityAt: row.last_activity_at,
            lastUsedAt: row.last_used_at,
          }
        : null;
    },
    patchSession: async (sessionId, patch) => {
      await database
        .updateTable('sessions')
        .set({
          credential_purpose: patch.credentialPurpose,
          auth_epoch: patch.authEpoch,
          schema_version: patch.schemaVersion,
          user_version: patch.userVersion,
          client_version: patch.clientVersion,
          grant_version: patch.grantVersion,
          expires_at: patch.expiresAt,
          idle_expires_at: patch.idleExpiresAt,
          last_activity_at: patch.lastActivityAt,
          last_used_at: patch.lastUsedAt,
        })
        .where('id', '=', sessionId)
        .execute();
    },
    patchGrant: async (userId, clientId, patch) => {
      await database
        .updateTable('user_application_grants')
        .set({ allowed: patch.allowed, session_version: patch.sessionVersion })
        .where('user_id', '=', userId)
        .where('client_id', '=', clientId)
        .execute();
    },
    removeGrant: async (userId, clientId) => {
      await database
        .deleteFrom('user_application_grants')
        .where('user_id', '=', userId)
        .where('client_id', '=', clientId)
        .execute();
    },
    markAccountDeleted: async (userId) => {
      await database
        .updateTable('users')
        .set({ is_deleted: true })
        .where('id', '=', userId)
        .execute();
    },
    events: async () => {
      const rows = await database
        .selectFrom('security_events')
        .selectAll()
        .where('action', '!=', REFUSED_EVENT_SEED_ACTION)
        .orderBy('id', 'asc')
        .execute();
      return rows.map((row) => ({
        action: row.action,
        actorId: row.actor_id,
        targetUserId: row.target_user_id,
        clientId: row.client_id,
        sessionId: row.session_id,
        reasonCode: row.reason_code,
      }));
    },
    absentSessionId: () => randomUUID(),
    foreignSessionId: () => AN_OBJECT_ID,
  };
}
