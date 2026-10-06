import assert from 'node:assert/strict';
import { symlinkSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { outcome, repository, writeIndexPath } from './test-repository.mjs';

const BAD = 'const value = input as ' + 'a' + 'ny;\n';

for (const [label, bytes] of [
  ['invalid UTF-8', [99, 97, 102, 233]],
  ['replacement character', [99, 97, 102, 239, 191, 189]],
]) {
  test(`${label} paths fail closed in staged, range, push and full scans`, (t) => {
    const repo = repository(t);
    repo.write('src/safe.ts', 'export {};\n');
    const base = repo.commit();
    // Insert raw bytes through Git's index protocol; macOS refuses these filesystem names.
    writeIndexPath(repo, [...Buffer.from('src/'), ...bytes, ...Buffer.from('.ts')], BAD);
    const staged = repo.check('--staged');
    const tree = repo.git('write-tree');
    const head = repo.git('commit-tree', tree, '-p', base, '-m', 'test: raw path');
    repo.git('update-ref', 'HEAD', head);
    const results = [
      staged,
      repo.check('--range', base, head),
      repo.checkInput(`refs/heads/feature ${head} refs/heads/staging ${base}\n`, '--push'),
      repo.check('--all'),
    ];
    for (const result of results) {
      assert.equal(result.status, 2);
      assert.match(
        result.diagnostic,
        /"src\/caf�\.ts".*unsupported replacement character.*rename the file/,
      );
    }
  });
}

for (const target of ['payload.txt', 'missing.txt']) {
  test(`source symlink to ${target} is refused without dereferencing in all modes`, (t) => {
    const repo = repository(t);
    repo.write('src/safe.ts', 'export {};\n');
    repo.write('payload.txt', BAD);
    const base = repo.commit();
    symlinkSync(`../${target}`, join(repo.root, 'src/link.ts'));
    repo.git('add', '.');
    const staged = repo.check('--staged');
    const head = repo.commit();
    for (const result of [
      staged,
      repo.check('--range', base, head),
      repo.checkInput(`refs/heads/feature ${head} refs/heads/staging ${base}\n`, '--push'),
      repo.check('--all'),
    ]) {
      assert.equal(result.status, 1);
      assert.match(
        result.diagnostic,
        /^(?:\[[a-f0-9]+\] )?src\/link\.ts:1: Source symlinks are refused; commit a regular source file\.$/m,
      );
      assert.deepEqual(result.hits, []);
    }
  });
}

test('artifact skips stop at repository and declared workspace roots', (t) => {
  const repo = repository(t);
  repo.write('package.json', '{"workspaces":["backend","apps/*"]}');
  repo.write('backend/package.json', '{}');
  repo.write('apps/client/package.json', '{}');
  const base = repo.commit();
  for (const file of [
    'dist/root.ts',
    'node_modules/root.ts',
    '.next/root.ts',
    '.expo/root.ts',
    'backend/dist/output.ts',
    'backend/node_modules/output.ts',
    'apps/client/.next/output.ts',
    'apps/client/.expo/output.ts',
    'backend/src/dist/service.ts',
    'backend/src/node_modules/service.ts',
    'apps/client/src/.next/service.ts',
    'apps/client/src/.expo/service.ts',
  ])
    repo.write(file, BAD);
  const head = repo.commit();
  for (const result of [repo.check('--all'), repo.check('--range', base, head)]) {
    assert.deepEqual(outcome(result), {
      status: 1,
      hits: [
        ['apps/client/src/.expo/service.ts', 1, 'a' + 's ' + 'a' + 'ny'],
        ['apps/client/src/.next/service.ts', 1, 'a' + 's ' + 'a' + 'ny'],
        ['backend/src/dist/service.ts', 1, 'a' + 's ' + 'a' + 'ny'],
        ['backend/src/node_modules/service.ts', 1, 'a' + 's ' + 'a' + 'ny'],
      ],
      caps: [],
    });
  }
});
