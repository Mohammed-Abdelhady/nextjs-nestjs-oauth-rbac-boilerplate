import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, expect, it } from 'vitest';
import { parseAllDocuments } from 'yaml';
import { templateContent } from '../scripts/sync-template.mjs';
import { isRecord } from '../src/manifest/read.js';
import { newFixture, runScript } from './sync-template-fixture.js';

const REPOSITORY_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

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

it('ships the project ignore list without only the instruction-file entries', () => {
  const fixture = newFixture(roots);
  const source = readFileSync(join(REPOSITORY_ROOT, '.gitignore'), 'utf8');
  const removed = source.split('\n').filter((line) => line === 'AGENTS.md' || line === 'CLAUDE.md');
  writeFileSync(join(fixture, '.gitignore'), source, 'utf8');
  runScript(fixture);

  const shipped = readFileSync(
    join(fixture, 'packages/create-nest-next-auth/template/_gitignore'),
    'utf8',
  );
  const expected = source
    .split('\n')
    .filter((line) => line !== 'AGENTS.md' && line !== 'CLAUDE.md')
    .join('\n');

  expect(removed).toEqual(['AGENTS.md', 'CLAUDE.md']);
  expect(shipped).toBe(expected);
});

it('ships commit scopes that match the available template workspaces', () => {
  const source = readFileSync(join(REPOSITORY_ROOT, 'commitlint.config.cjs'), 'utf8');
  const shipped = templateContent('commitlint.config.cjs', Buffer.from(source)).toString();
  const expected = source.replace(/^\s*'mobile',\r?\n/m, '');

  expect(shipped).toBe(expected);
});
