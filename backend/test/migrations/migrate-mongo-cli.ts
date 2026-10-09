import { execFile as execFileCallback } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCallback);
const requireFromTest = createRequire(__filename);

interface MigrateMongoPackage {
  bin: { 'migrate-mongo': string };
}

const migrateMongoEntry = requireFromTest.resolve('migrate-mongo');
const migrateMongoRoot = resolve(dirname(migrateMongoEntry), '..');
const migrateMongoPackage = requireFromTest(
  resolve(migrateMongoRoot, 'package.json'),
) as MigrateMongoPackage;
const migrateMongoBin = resolve(
  migrateMongoRoot,
  migrateMongoPackage.bin['migrate-mongo'],
);
const backendDirectory = resolve(__dirname, '../..');
const migrationConfigPath = resolve(
  backendDirectory,
  'migrate-mongo-config.js',
);
const MIGRATION_PROCESS_TIMEOUT_MS = 30_000;

export async function runMigrateMongo(
  command: 'up' | 'down',
  mongoUri: string,
): Promise<string> {
  try {
    const result = await execFile(
      process.execPath,
      [migrateMongoBin, command, '-f', migrationConfigPath],
      {
        cwd: backendDirectory,
        env: { ...process.env, MONGO_URI: mongoUri },
        timeout: MIGRATION_PROCESS_TIMEOUT_MS,
        encoding: 'utf8',
      },
    );
    return result.stdout;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const stderr = readStderr(error);
    throw new Error(
      `migrate-mongo ${command} failed: ${message}${stderr ? `\n${stderr}` : ''}`,
      { cause: error },
    );
  }
}

function readStderr(error: unknown): string {
  if (!(error instanceof Error) || !('stderr' in error)) {
    return '';
  }
  if (typeof error.stderr === 'string') {
    return error.stderr;
  }
  return Buffer.isBuffer(error.stderr) ? error.stderr.toString('utf8') : '';
}
