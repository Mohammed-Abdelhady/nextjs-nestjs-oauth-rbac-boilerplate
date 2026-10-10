import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Pool } from 'pg';

const MIGRATIONS_DIRECTORY = join(__dirname, 'migrations');
const MIGRATION_FILE = /^\d{4}_[a-z0-9_]+\.sql$/;

/** The adapter's migrations, in the order they are applied. */
export function listPrototypeMigrations(): string[] {
  return readdirSync(MIGRATIONS_DIRECTORY)
    .filter((file) => MIGRATION_FILE.test(file))
    .sort();
}

/**
 * Applies the adapter's plain SQL files in name order, each in its own
 * transaction, and records the ones applied. The files are part of the adapter
 * and are run as written.
 */
export async function migratePrototypeDatabase(pool: Pool): Promise<string[]> {
  const client = await pool.connect();
  const applied: string[] = [];
  try {
    await client.query(
      `CREATE TABLE IF NOT EXISTS schema_migrations (
         name text PRIMARY KEY,
         applied_at timestamptz NOT NULL DEFAULT now()
       )`,
    );
    const known = await client.query<{ name: string }>(
      'SELECT name FROM schema_migrations',
    );
    const done = new Set(known.rows.map(({ name }) => name));
    const files = listPrototypeMigrations();
    for (const file of files) {
      if (done.has(file)) continue;
      const statements = readFileSync(join(MIGRATIONS_DIRECTORY, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(statements);
        await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [
          file,
        ]);
        await client.query('COMMIT');
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
      applied.push(file);
    }
    return applied;
  } finally {
    client.release();
  }
}
