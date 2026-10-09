import { Kysely, PostgresDialect, PostgresPool } from 'kysely';
import { Client, Pool, PoolClient } from 'pg';
import { commitCheckedPool } from './adapter/postgres-commit-tag';
import {
  openPrototypeDatabase,
  PrototypeDatabase,
} from './adapter/postgres-database';
import { migratePrototypeDatabase } from './adapter/postgres-migrations';
import {
  PostgresTestServer,
  startPostgresTestServer,
} from './server/postgres-test-server';

/**
 * Ends every other session of this database that the filter selects, and waits
 * for the server to report each one gone. Ending a session rolls its
 * transaction back and frees its locks.
 */
const END_SESSIONS = `
  SELECT pg_terminate_backend(pid, $1)
    FROM pg_stat_activity
   WHERE pid <> pg_backend_pid()
     AND datname = current_database()`;
const WITH_OPEN_WORK = ' AND xact_start IS NOT NULL';
/** The server's own bound on waiting for one session to go. */
const SESSION_END_WAIT_MS = 30_000;

export interface PrototypeConnection<
  Dialect extends PostgresDialect = PostgresDialect,
> {
  readonly server: PostgresTestServer;
  readonly dialect: Dialect;
  readonly pool: Pool;
  readonly database: Kysely<PrototypeDatabase>;
  readonly appliedMigrations: string[];
  /**
   * Rolls back whatever an earlier case left open, so its locks cannot hold
   * the next case's reset. Call it first in every `reset`.
   */
  readonly rollBackOpenWork: () => Promise<void>;
  /**
   * Stops the server whatever state the cases left: open transactions are
   * rolled back, and a connection a case never handed back is not waited for.
   */
  readonly close: () => Promise<void>;
}

/** A harness on the adapter's own dialect. */
export function openPrototypeConnection(): Promise<PrototypeConnection> {
  return openPrototypeConnectionOn(
    (pool) => new PostgresDialect({ pool: commitCheckedPool(pool) }),
  );
}

/**
 * The one way a PostgreSQL harness gets its server, pool and migrated
 * database, and the one way it lets them go. A boot that fails part way stops
 * the server it started.
 */
export async function openPrototypeConnectionOn<
  Dialect extends PostgresDialect,
>(
  makeDialect: (pool: PostgresPool) => Dialect,
): Promise<PrototypeConnection<Dialect>> {
  const server = await startPostgresTestServer();
  const pool = new Pool(server.connection);
  const open = new Set<PoolClient>();
  let whenNoneOpen: (() => void) | undefined;
  // An idle connection the server drops must not take the test process down.
  pool.on('error', () => undefined);
  pool.on('connect', (client) => {
    open.add(client);
    // Nor must one a case still holds when teardown ends its session.
    client.on('error', () => undefined);
    client.once('end', () => {
      open.delete(client);
      if (open.size === 0) whenNoneOpen?.();
    });
  });

  // Outside the pool, so it is still there when a case holds every pooled
  // connection, and so ending the others never ends this one.
  const admin = new Client(server.connection);
  admin.on('error', () => undefined);
  const endSessions = async (filter: string): Promise<void> => {
    await admin.query(END_SESSIONS + filter, [SESSION_END_WAIT_MS]);
  };

  const close = async (): Promise<void> => {
    try {
      await endSessions('');
      await admin.end();
      if (open.size > 0) {
        await new Promise<void>((resolve) => {
          whenNoneOpen = resolve;
        });
      }
      // Every socket is closed now. A connection that was never handed back
      // stays counted by the pool, and ending the pool would wait for it.
      if (pool.totalCount === 0) {
        await pool.end();
      }
    } finally {
      await server.stop();
    }
  };

  try {
    await admin.connect();
    const appliedMigrations = await migratePrototypeDatabase(pool);
    const dialect = makeDialect(pool);
    const database = openPrototypeDatabase(pool, dialect);
    return {
      server,
      dialect,
      pool,
      database,
      appliedMigrations,
      rollBackOpenWork: () => endSessions(WITH_OPEN_WORK),
      close,
    };
  } catch (error) {
    await close();
    throw error;
  }
}
