import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { checkPackageManager, legacyReferences } from '../check-package-manager.mjs';
import { repository } from './test-repository.mjs';

const OLD_MANAGER = 'n' + 'pm';
const OLD_EXEC = 'np' + 'x';
const OLD_LOCK = 'package' + '-lock';

test('inventory rejects every legacy command and lock reference with file and line', () => {
  for (const [suffix, reference] of [
    ['run build', `${OLD_MANAGER} run`],
    ['ci', `${OLD_MANAGER} ci`],
    ['install', `${OLD_MANAGER} install`],
  ]) {
    assert.deepEqual(legacyReferences('docs/setup.md', `heading\n${OLD_MANAGER} ${suffix}\n`), [
      { file: 'docs/setup.md', line: 2, reference },
    ]);
  }
  assert.deepEqual(legacyReferences('.husky/pre-commit', `${OLD_EXEC} eslint`), [
    { file: '.husky/pre-commit', line: 1, reference: `${OLD_EXEC} ` },
  ]);
  assert.deepEqual(legacyReferences('Dockerfile', `COPY ${OLD_LOCK}.json ./`), [
    { file: 'Dockerfile', line: 1, reference: OLD_LOCK },
  ]);
  assert.deepEqual(legacyReferences(`${OLD_LOCK}.json`, '{}'), [
    { file: `${OLD_LOCK}.json`, line: 1, reference: OLD_LOCK },
  ]);
});

test('inventory accepts pnpm, publication and changelogs without exempting installer source', () => {
  assert.deepEqual(
    legacyReferences(
      'README.md',
      'pnpm run build\npnpm install --frozen-lockfile\npnpm exec eslint\n',
    ),
    [],
  );
  assert.deepEqual(
    legacyReferences('packages/create-nest-next-auth/test/packed-cli.ts', `${OLD_MANAGER} install`),
    [],
  );
  assert.deepEqual(legacyReferences('.gitignore', `${OLD_LOCK}.json\n`), []);
  assert.deepEqual(legacyReferences('CHANGELOG.md', `${OLD_MANAGER} ci`), []);
  assert.deepEqual(
    legacyReferences('packages/create-nest-next-auth/src/cli.ts', `${OLD_MANAGER} run build`),
    [
      {
        file: 'packages/create-nest-next-auth/src/cli.ts',
        line: 1,
        reference: `${OLD_MANAGER} run`,
      },
    ],
  );
});

test('tracked inventory scrubs hook Git variables and ignores deleted, untracked and protected files', (t) => {
  const fixture = repository(t);
  fixture.write('README.md', `heading\n${OLD_MANAGER} ci\n`);
  fixture.write('removed.md', `${OLD_MANAGER} ci`);
  fixture.write('.env.synthetic', `${OLD_MANAGER} ci`);
  fixture.write('binary.bin', Buffer.from([0, 1, 2]));
  fixture.git('add', '.');
  rmSync(join(fixture.root, 'removed.md'));
  fixture.write('untracked.md', `${OLD_MANAGER} ci`);
  const previous = process.env.GIT_DIR;
  process.env.GIT_DIR = join(fixture.root, 'missing-repository');
  try {
    assert.deepEqual(checkPackageManager(fixture.root), [
      { file: 'README.md', line: 2, reference: `${OLD_MANAGER} ci` },
    ]);
  } finally {
    if (previous === undefined) delete process.env.GIT_DIR;
    else process.env.GIT_DIR = previous;
  }
});

test('non-Git scaffolds scan text and UTF-16 while refusing symlink traversal', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'manager-inventory-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { build: 'build' } }));
  writeFileSync(join(root, 'README.md'), `pnpm run build\n`);
  writeFileSync(
    join(root, 'encoded.md'),
    Buffer.concat([Buffer.from([255, 254]), Buffer.from(`${OLD_MANAGER} ci`, 'utf16le')]),
  );
  symlinkSync(join(root, 'encoded.md'), join(root, 'link.md'));
  assert.deepEqual(checkPackageManager(root), [
    { file: 'encoded.md', line: 1, reference: `${OLD_MANAGER} ci` },
  ]);
});

test('inventory catches documented pnpm scripts missing from every workspace manifest', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'manager-scripts-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  writeFileSync(join(root, 'package.json'), JSON.stringify({ scripts: { lint: 'lint' } }));
  mkdirSync(join(root, 'backend'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(
    join(root, 'backend/package.json'),
    JSON.stringify({ scripts: { seed: 'seed' } }),
  );
  mkdirSync(join(root, 'empty'), { recursive: true });
  writeFileSync(join(root, 'empty/package.json'), JSON.stringify({ scripts: null }));
  writeFileSync(
    join(root, 'docs/commands.md'),
    'pnpm run lint\npnpm --filter backend run seed\npnpm run migration:run add-permissions\npnpm exec eslint\npnpm run <script>\n',
  );

  assert.deepEqual(checkPackageManager(root), [
    {
      file: 'docs/commands.md',
      line: 3,
      reference: 'migration:run',
      kind: 'missing-script',
    },
  ]);
});
