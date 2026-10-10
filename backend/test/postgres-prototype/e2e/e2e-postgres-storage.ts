import type { INestApplication } from '@nestjs/common';
import type { TestingModuleBuilder } from '@nestjs/testing';
import type { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import {
  openPostgresPool,
  POSTGRES_DATABASE,
  POSTGRES_POOL,
  PostgresDatabase,
} from '../../../src/common/persistence/postgres/postgres-connection';
import { POSTGRES_HEALTH_POOL } from '../../../src/health/persistence/postgres/postgres-health-persistence';
import { ApplicationRegistry } from '../../../src/session/applications/application-registry';
import type {
  AttachedE2eStorage,
  E2eAccountFixture,
  E2eStorage,
} from '../../utils/e2e-storage';
import { emptyEveryTable } from '../postgres-connection';
import {
  connectionUrl,
  E2E_TEMPLATE_DATABASE,
  onServer,
  quotedName,
  sharedPostgresServer,
} from './postgres-e2e-server';

const EMAIL_PROVIDER = 'email';

/**
 * A database of its own on the run's shared server, copied from the migrated
 * template and dropped when the fixture closes.
 */
export async function startPostgresE2eStorage(): Promise<E2eStorage> {
  const server = sharedPostgresServer();
  const name = `auth_e2e_${randomUUID().replaceAll('-', '')}`;
  await onServer(server, (client) =>
    client.query(
      `CREATE DATABASE ${quotedName(name)} TEMPLATE ${quotedName(E2E_TEMPLATE_DATABASE)}`,
    ),
  );

  let pool: Pool | undefined;
  let healthPool: Pool | undefined;

  return {
    environment: {
      DATABASE_TYPE: 'postgres',
      POSTGRES_URL: connectionUrl(server, name),
    },
    prepare: (builder: TestingModuleBuilder): Promise<void> => {
      // The fixture owns the pool on its own database, as the MongoDB fixture
      // owns its connection: a second application booted in one suite must not
      // reach the database of the first through settings read at first load.
      pool = openPostgresPool({ ...server, database: name });
      builder.overrideProvider(POSTGRES_POOL).useValue(pool);
      healthPool = openPostgresPool({ ...server, database: name, max: 1 });
      builder.overrideProvider(POSTGRES_HEALTH_POOL).useValue(healthPool);
      return Promise.resolve();
    },
    attach: (app: INestApplication): Promise<AttachedE2eStorage> => {
      const database = app.get<PostgresDatabase>(POSTGRES_DATABASE, {
        strict: false,
      });
      const applications = app.get(ApplicationRegistry, { strict: false });
      const seedAccounts = async (
        accounts: E2eAccountFixture[],
      ): Promise<void> => {
        await database
          .insertInto('users')
          .values(
            accounts.map((account) => ({
              email: account.email,
              name: account.name,
              role: account.role,
              permissions: account.permissions,
              password_hash: account.password,
              is_verified: account.isVerified,
              auth_provider: EMAIL_PROVIDER,
              primary_provider: EMAIL_PROVIDER,
            })),
          )
          .execute();
      };
      return Promise.resolve({
        state: {
          seedAccounts,
          createApplication: async (application) => {
            await database
              .insertInto('applications')
              .values({
                client_id: application.clientId,
                display_name: application.displayName,
                platform: application.platform,
                environment: application.environment,
                client_type: application.clientType,
                enabled: application.enabled,
                redirect_uris: application.redirectUris,
                allowed_origins: application.allowedOrigins,
                audiences: application.audiences,
                allowed_scopes: application.allowedScopes,
                absolute_lifetime_ms: application.policy.absoluteLifetimeMs,
                idle_lifetime_ms: application.policy.idleLifetimeMs,
                session_version: application.sessionVersion,
              })
              .execute();
          },
          sessionIdWithPurpose: async (purpose) => {
            const row = await database
              .selectFrom('sessions')
              .select('id')
              .where('credential_purpose', '=', purpose)
              .executeTakeFirst();
            return row ? row.id : null;
          },
        },
        empty: () => emptyEveryTable(database),
        seedApplications: async () => {
          await applications.seedFirstPartyApplications();
          await applications.ensureClientOriginAllowed();
        },
        seedAccounts,
      });
    },
    stop: async () => {
      for (const owned of [pool, healthPool]) {
        if (owned && !owned.ended) {
          await owned.end();
        }
      }
      await onServer(server, async (client) => {
        await client.query(
          `DROP DATABASE IF EXISTS ${quotedName(name)} WITH (FORCE)`,
        );
      });
    },
  };
}
