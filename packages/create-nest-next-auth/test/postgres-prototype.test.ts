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
    'backend/src/auth/passkeys/contract/passkeys-account-deletion.contract.postgres.integration.spec.ts',
    'backend/src/auth/passkeys/contract/passkeys.contract.postgres.integration.spec.ts',
    'backend/src/auth/pending-codes/pending-code-outages.postgres.spec.ts',
    'backend/src/auth/pending-codes/pending-codes.contract.postgres.integration.spec.ts',
    'backend/src/auth/two-factor/contract/two-factor-account-deletion.contract.postgres.integration.spec.ts',
    'backend/src/auth/two-factor/contract/two-factor-whole-changes.postgres.integration.spec.ts',
    'backend/src/auth/two-factor/contract/two-factor.contract.postgres.integration.spec.ts',
    'backend/src/role/stores/role-stores.contract.postgres.integration.spec.ts',
    'backend/src/session/applications/applications.contract.postgres.integration.spec.ts',
    'backend/src/session/authority/postgres-lost-answer.spec.ts',
    'backend/src/session/authority/session-authority.contract.postgres.integration.spec.ts',
    'backend/src/session/events/proofs-events-outages.postgres.spec.ts',
    'backend/src/session/events/proofs-events.contract.postgres.integration.spec.ts',
    'backend/src/session/issuance/browser-issuance.contract.postgres.integration.spec.ts',
    'backend/src/session/issuance/postgres-harness-teardown.integration.spec.ts',
    'backend/src/session/issuance/postgres-prototype-errors.spec.ts',
    'backend/src/session/issuance/postgres-prototype.integration.spec.ts',
    'backend/src/session/native/contract/native-sign-in.contract.postgres.integration.spec.ts',
    'backend/src/user/linked-accounts-contract/linked-accounts.contract.postgres.integration.spec.ts',
    'backend/src/user/stores/account-stores.contract.postgres.integration.spec.ts',
    'backend/test/postgres-prototype/adapter/migrations/0001_browser_issuance.sql',
    'backend/test/postgres-prototype/adapter/migrations/0002_roles.sql',
    'backend/test/postgres-prototype/adapter/migrations/0003_pending_codes.sql',
    'backend/test/postgres-prototype/adapter/migrations/0004_browser_proofs_security_events.sql',
    'backend/test/postgres-prototype/adapter/migrations/0005_accounts.sql',
    'backend/test/postgres-prototype/adapter/migrations/0006_session_authority_revocation.sql',
    'backend/test/postgres-prototype/adapter/migrations/0007_applications_grants.sql',
    'backend/test/postgres-prototype/adapter/migrations/0008_two_factor.sql',
    'backend/test/postgres-prototype/adapter/migrations/0009_passkeys.sql',
    'backend/test/postgres-prototype/adapter/migrations/0010_native_sign_in.sql',
    'backend/test/postgres-prototype/adapter/postgres-account-profile.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-admin-account.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-application-access.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-application-registry.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-authority-applications.ts',
    'backend/test/postgres-prototype/adapter/postgres-browser-issuance.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-browser-proof.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-commit-tag.ts',
    'backend/test/postgres-prototype/adapter/postgres-linked-account.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-magic-link.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-native-access.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-native-authorization.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-native-credential.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-native-rotation.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-native-security-events.ts',
    'backend/test/postgres-prototype/adapter/postgres-native-tables.ts',
    'backend/test/postgres-prototype/adapter/postgres-passkey-challenge.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-passkey.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-pending-registration.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-role-change.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-second-factor-challenge.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-second-factor.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-security-event.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-session-authority.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-session-revocation.store.ts',
    'backend/test/postgres-prototype/adapter/postgres-session-rows.ts',
    'backend/test/postgres-prototype/postgres-accounts-harness.ts',
    'backend/test/postgres-prototype/postgres-applications-harness.ts',
    'backend/test/postgres-prototype/postgres-authority-harness.ts',
    'backend/test/postgres-prototype/postgres-connection.ts',
    'backend/test/postgres-prototype/postgres-issuance-harness.ts',
    'backend/test/postgres-prototype/postgres-linked-accounts-harness.ts',
    'backend/test/postgres-prototype/postgres-magic-link-harness.ts',
    'backend/test/postgres-prototype/postgres-native-harness.ts',
    'backend/test/postgres-prototype/postgres-passkeys-harness.ts',
    'backend/test/postgres-prototype/postgres-pending-codes-harness.ts',
    'backend/test/postgres-prototype/postgres-proofs-events-harness.ts',
    'backend/test/postgres-prototype/postgres-role-harness.ts',
    'backend/test/postgres-prototype/postgres-two-factor-harness.ts',
    'backend/test/postgres-prototype/server/postgres-orphans.test.mjs',
    'backend/test/postgres-prototype/server/postgres-server.mjs',
    'backend/test/postgres-prototype/server/postgres-test-server.ts',
    'backend/test/postgres-prototype/teardown-fixtures/abandoned-work.fixture-spec.ts',
  ];
  const shipped = [
    'backend/src/admin/persistence/mongo/mongo-admin-account.store.ts',
    'backend/src/admin/stores/admin-account.store.ts',
    'backend/src/auth/magic-link/contract/magic-link-outage-cases.harness-spec.ts',
    'backend/src/auth/magic-link/contract/magic-link.contract.mongo.integration.spec.ts',
    'backend/src/auth/magic-link/persistence/mongo/mongo-magic-link-outages.spec.ts',
    'backend/src/auth/magic-link/stores/magic-link.store.ts',
    'backend/src/auth/passkeys/contract/passkeys-account-deletion.contract.mongo.integration.spec.ts',
    'backend/src/auth/passkeys/contract/passkeys-account-deletion.harness-spec.ts',
    'backend/src/auth/passkeys/contract/passkeys-contract-suite.harness-spec.ts',
    'backend/src/auth/passkeys/contract/passkeys.contract.mongo.integration.spec.ts',
    'backend/src/auth/passkeys/persistence/mongo/mongo-passkey-challenge.store.ts',
    'backend/src/auth/passkeys/persistence/mongo/mongo-passkey.store.ts',
    'backend/src/auth/passkeys/stores/passkey-challenge.store.ts',
    'backend/src/auth/passkeys/stores/passkey.store.ts',
    'backend/src/auth/pending-codes/pending-codes.contract.mongo.integration.spec.ts',
    'backend/src/auth/pending-codes/pending-registration.store.ts',
    'backend/src/auth/persistence/mongo/mongo-pending-registration.store.ts',
    'backend/src/auth/persistence/mongo/mongo-store-outages.spec.ts',
    'backend/src/auth/two-factor/contract/two-factor-account-deletion.contract.mongo.integration.spec.ts',
    'backend/src/auth/two-factor/contract/two-factor-account-deletion.harness-spec.ts',
    'backend/src/auth/two-factor/contract/two-factor-contract-suite.harness-spec.ts',
    'backend/src/auth/two-factor/contract/two-factor.contract.mongo.integration.spec.ts',
    'backend/src/auth/two-factor/persistence/mongo/mongo-second-factor-challenge.store.ts',
    'backend/src/auth/two-factor/persistence/mongo/mongo-second-factor.store.ts',
    'backend/src/auth/two-factor/stores/second-factor-challenge.store.ts',
    'backend/src/auth/two-factor/stores/second-factor.store.ts',
    'backend/src/role/persistence/mongo/mongo-role-change.store.ts',
    'backend/src/role/stores/role-change.store.ts',
    'backend/src/role/stores/role-stores.contract.mongo.integration.spec.ts',
    'backend/src/session/applications/application-access.store.ts',
    'backend/src/session/applications/application-access.ts',
    'backend/src/session/applications/application-registry.store.ts',
    'backend/src/session/applications/application-registry.ts',
    'backend/src/session/applications/applications.contract.mongo.integration.spec.ts',
    'backend/src/session/authority/authority-applications.ts',
    'backend/src/session/authority/session-authority.contract.mongo.integration.spec.ts',
    'backend/src/session/authority/session-authority.store.ts',
    'backend/src/session/authority/session-validator.ts',
    'backend/src/session/events/proofs-events.contract.mongo.integration.spec.ts',
    'backend/src/session/events/security-event-recorder.ts',
    'backend/src/session/events/security-event.store.ts',
    'backend/src/session/issuance/browser-issuance.contract.mongo.integration.spec.ts',
    'backend/src/session/issuance/browser-issuance.store.ts',
    'backend/src/session/native/access/native-access-validator.ts',
    'backend/src/session/native/authorize/native-authorization.store.ts',
    'backend/src/session/native/contract/native-sign-in.contract.mongo.integration.spec.ts',
    'backend/src/session/native/credentials/native-access.store.ts',
    'backend/src/session/native/credentials/native-credential.store.ts',
    'backend/src/session/native/credentials/native-rotation.store.ts',
    'backend/src/session/native/credentials/native-security-events.ts',
    'backend/src/session/native/persistence/mongo/mongo-native-access.store.ts',
    'backend/src/session/native/persistence/mongo/mongo-native-authorization.store.ts',
    'backend/src/session/native/persistence/mongo/mongo-native-credential.store.ts',
    'backend/src/session/native/persistence/mongo/mongo-native-rotation.store.ts',
    'backend/src/session/native/persistence/mongo/mongo-native-security-events.ts',
    'backend/src/session/persistence/mongo/mongo-application-access.store.ts',
    'backend/src/session/persistence/mongo/mongo-application-registry.store.ts',
    'backend/src/session/persistence/mongo/mongo-browser-issuance.store.ts',
    'backend/src/session/persistence/mongo/mongo-browser-proof.store.ts',
    'backend/src/session/persistence/mongo/mongo-proofs-events-outages.spec.ts',
    'backend/src/session/persistence/mongo/mongo-security-event.store.ts',
    'backend/src/session/persistence/mongo/mongo-session-authority.store.ts',
    'backend/src/session/persistence/mongo/mongo-session-revocation.store.ts',
    'backend/src/session/proofs/browser-proof.store.ts',
    'backend/src/session/revocation/session-revocation.store.ts',
    'backend/src/session/revocation/session-revoker.ts',
    'backend/src/user/linked-accounts-contract/linked-accounts.contract.mongo.integration.spec.ts',
    'backend/src/user/persistence/mongo/mongo-account-profile.store.ts',
    'backend/src/user/stores/account-profile.store.ts',
    'backend/src/user/stores/account-stores.contract.mongo.integration.spec.ts',
    'backend/test/utils/auth/pending-codes-contract/pending-codes-contract.ts',
    'backend/test/utils/auth/store-outage-cases.ts',
    'backend/test/utils/native/contract/mongo-native-harness.ts',
    'backend/test/utils/native/contract/native-contract.ts',
    'backend/test/utils/role/role-contract/role-contract.ts',
    'backend/test/utils/session/applications-contract/applications-contract.ts',
    'backend/test/utils/session/authority-contract/authority-contract.ts',
    'backend/test/utils/session/issuance-contract/issuance-contract.ts',
    'backend/test/utils/session/proofs-events-contract/proofs-events-contract.ts',
    'backend/test/utils/session/proofs-events-contract/proofs-events-outage-cases.ts',
    'backend/test/utils/user/accounts-contract/accounts-contract.ts',
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
