import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { parseAllDocuments } from 'yaml';
import { templateContent } from '../scripts/sync-template.mjs';
import { isRecord } from '../src/manifest/read.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

function lockfileDocuments(source: string): unknown[] {
  return parseAllDocuments(source).map((document) => document.toJS());
}

it('ships the lockfile without the installer workspace importer', () => {
  const source = readFileSync(join(REPOSITORY_ROOT, 'pnpm-lock.yaml'));
  const shipped = templateContent('pnpm-lock.yaml', source).toString();
  const before = lockfileDocuments(source.toString());
  const after = lockfileDocuments(shipped);
  const originalProjectLock = before[1];
  const templateProjectLock = after[1];

  if (!isRecord(originalProjectLock) || !isRecord(templateProjectLock)) {
    throw new Error('The project lockfile document is missing.');
  }
  if (!isRecord(originalProjectLock.importers) || !isRecord(templateProjectLock.importers)) {
    throw new Error('The project lockfile importers are missing.');
  }
  expect(Object.keys(templateProjectLock.importers).sort()).toEqual([
    '.',
    'backend',
    'frontend',
    'mobile/auth',
    'shared/core',
    'shared/sdk',
  ]);
  expect(templateProjectLock.packages).toEqual(originalProjectLock.packages);
  expect(templateProjectLock.snapshots).toEqual(originalProjectLock.snapshots);
  expect(after[0]).toEqual(before[0]);
});
