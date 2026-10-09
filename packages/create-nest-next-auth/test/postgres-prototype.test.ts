import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { POSTGRES_PROTOTYPE_PACKAGES } from '../src/constants/index.js';
import { isRecord } from '../src/manifest/read.js';
import { deleteMatchingFiles } from '../src/prune/files.js';
import { listFiles } from '../src/utils/fs.js';
import { matchesAnyGlob } from '../src/utils/glob.js';

const REPOSITORY = fileURLToPath(new URL('../../../', import.meta.url));
const BACKEND_SOURCES = /^backend\/(?:src|test)\/.*\.(?:ts|mts|mjs)$/;
// A prototype package by name, or any path into the prototype folder.
const PROTOTYPE_IMPORT = new RegExp(
  `(?:from|import|require)\\s*\\(?\\s*['"](?:(?:${POSTGRES_PROTOTYPE_PACKAGES.join('|')})(?:/[^'"]*)?|[^'"]*/postgres-prototype/[^'"]*)['"]`,
);

const roots: string[] = [];
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

async function alwaysRemoved(): Promise<string[]> {
  const manifest: unknown = JSON.parse(
    await readFile(join(REPOSITORY, 'template.manifest.json'), 'utf8'),
  );
  if (!isRecord(manifest) || !isRecord(manifest.core)) throw new Error('manifest has no core');
  const globs: unknown = manifest.core.alwaysRemoveFiles;
  if (!Array.isArray(globs)) throw new Error('manifest has no alwaysRemoveFiles');
  return globs.filter((glob): glob is string => typeof glob === 'string');
}

it('removes the PostgreSQL prototype from a generated project and keeps the shared contract', async () => {
  const root = await mkdtemp(join(tmpdir(), 'cna-postgres-prototype-'));
  roots.push(root);
  const prototype = [
    'backend/src/auth/magic-link/contract/magic-link-outages.postgres.spec.ts',
    'backend/src/auth/magic-link/contract/magic-link.contract.postgres.integration.spec.ts',
    'backend/src/auth/pending-codes/pending-code-outages.postgres.spec.ts',
    'backend/src/auth/pending-codes/pending-codes.contract.postgres.integration.spec.ts',
    'backend/src/role/stores/role-stores.contract.postgres.integration.spec.ts',
    'backend/src/session/issuance/browser-issuance.contract.postgres.integration.spec.ts',
    'backend/src/session/issuance/postgres-prototype-errors.spec.ts',
    'backend/src/session/issuance/postgres-prototype.integration.spec.ts',
    'backend/test/postgres-prototype/adapter/migrations/0001_browser_issuance.sql',
    'backend/test/postgres-prototype/adapter/migrations/0002_roles.sql',
    'backend/test/postgres-prototype/adapter/migrations/0003_pending_codes.sql',
    'backend/test/postgres-prototype/adapter/postgres-browser-issuance.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-magic-link.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-pending-registration.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-role-change.store.ts',
    'backend/test/postgres-prototype/postgres-issuance-harness.ts',
    'backend/test/postgres-prototype/postgres-magic-link-harness.ts',
    'backend/test/postgres-prototype/postgres-pending-codes-harness.ts',
    'backend/test/postgres-prototype/postgres-role-harness.ts',
    'backend/test/postgres-prototype/server/postgres-orphans.test.mjs',
    'backend/test/postgres-prototype/server/postgres-server.mjs',
  ];
  const shipped = [
    'backend/src/auth/magic-link/contract/magic-link-outage-cases.harness-spec.ts',
    'backend/src/auth/magic-link/contract/magic-link.contract.mongo.integration.spec.ts',
    'backend/src/auth/magic-link/persistence/mongo/mongo-magic-link-outages.spec.ts',
    'backend/src/auth/magic-link/stores/magic-link.store.ts',
    'backend/src/auth/pending-codes/pending-codes.contract.mongo.integration.spec.ts',
    'backend/src/auth/pending-codes/pending-registration.store.ts',
    'backend/src/auth/persistence/mongo/mongo-pending-registration.store.ts',
    'backend/src/auth/persistence/mongo/mongo-store-outages.spec.ts',
    'backend/src/role/persistence/mongo/mongo-role-change.store.ts',
    'backend/src/role/stores/role-change.store.ts',
    'backend/src/role/stores/role-stores.contract.mongo.integration.spec.ts',
    'backend/src/session/issuance/browser-issuance.contract.mongo.integration.spec.ts',
    'backend/src/session/issuance/browser-issuance.store.ts',
    'backend/src/session/persistence/mongo/mongo-browser-issuance.store.ts',
    'backend/test/utils/auth/pending-codes-contract/pending-codes-contract.ts',
    'backend/test/utils/auth/store-outage-cases.ts',
    'backend/test/utils/role/role-contract/role-contract.ts',
    'backend/test/utils/session/issuance-contract/issuance-contract.ts',
  ];
  for (const file of [...prototype, ...shipped]) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), '');
  }

  const deleted = await deleteMatchingFiles(root, await alwaysRemoved());

  expect({ deleted: [...deleted].sort(), left: (await listFiles(root)).sort() }).toEqual({
    deleted: prototype,
    left: shipped,
  });
});

it('ships no backend file that imports the prototype packages or the prototype folder', async () => {
  const removed = await alwaysRemoved();
  const sources = (await listFiles(join(REPOSITORY, 'backend')))
    .map((file) => `backend/${file}`)
    .filter((file) => BACKEND_SOURCES.test(file));

  const importers: string[] = [];
  for (const file of sources) {
    if (PROTOTYPE_IMPORT.test(await readFile(join(REPOSITORY, file), 'utf8'))) importers.push(file);
  }

  expect({
    found: importers.length > 0,
    shipped: importers.filter((file) => !matchesAnyGlob(file, removed)),
  }).toEqual({ found: true, shipped: [] });
});
