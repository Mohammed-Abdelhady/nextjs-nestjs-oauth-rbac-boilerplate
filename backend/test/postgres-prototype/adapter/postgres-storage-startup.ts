import { Pool } from 'pg';
import {
  StorageNotReadyError,
  StorageStartup,
} from '../../../src/common/persistence/storage-startup';
import { listPrototypeMigrations } from './postgres-migrations';

const UNDEFINED_TABLE = '42P01';

function isUndefinedTable(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    Reflect.get(error, 'code') === UNDEFINED_TABLE
  );
}

/**
 * Checks and never changes anything: the unique rules and indexes are part of
 * the migrations, and a migration is applied by an operator, not by a server
 * that is starting. A database that is behind this build, or ahead of it, is
 * refused with the names of the migrations that differ.
 */
export class PostgresStorageStartup extends StorageStartup {
  constructor(
    private readonly pool: Pick<Pool, 'query'>,
    private readonly expected: string[] = listPrototypeMigrations(),
  ) {
    super();
  }

  async prepare(): Promise<void> {
    const applied = await this.appliedMigrations();
    const missing = this.expected.filter((name) => !applied.has(name));
    if (missing.length > 0) {
      throw new StorageNotReadyError(
        `The database is behind this build. Apply these migrations in order, then start again: ${missing.join(', ')}`,
      );
    }
    const known = new Set(this.expected);
    const unknown = [...applied].filter((name) => !known.has(name)).sort();
    if (unknown.length > 0) {
      throw new StorageNotReadyError(
        `The database holds migrations this build does not carry: ${unknown.join(', ')}. Start the build that carries them, or restore the database.`,
      );
    }
  }

  /** A database nothing was ever applied to has no record at all. */
  private async appliedMigrations(): Promise<Set<string>> {
    try {
      const recorded = await this.pool.query<{ name: string }>(
        'SELECT name FROM schema_migrations',
      );
      return new Set(recorded.rows.map(({ name }) => name));
    } catch (error) {
      if (isUndefinedTable(error)) {
        return new Set();
      }
      throw error;
    }
  }
}
