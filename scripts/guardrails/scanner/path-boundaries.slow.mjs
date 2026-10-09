import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, writeIndexPath } from '../test-repository.mjs';

for (const [label, bytes] of [
  ['replacement non-target', [...Buffer.from('docs/n'), 239, 191, 189, ...Buffer.from('.png')]],
  ['invalid-byte non-target', [...Buffer.from('assets/bad'), 255, ...Buffer.from('.png')]],
]) {
  test(`${label} passes all modes and can be renamed`, (t) => {
    const repo = repository(t);
    repo.write('package.json', '{}');
    const base = repo.commit();
    writeIndexPath(repo, bytes, 'const value = input as ' + 'a' + 'ny;\n');
    const staged = repo.check('--staged');
    const tree = repo.git('write-tree');
    const head = repo.git('commit-tree', tree, '-p', base, '-m', 'test: asset bytes');
    repo.git('update-ref', 'HEAD', head);
    for (const result of [
      staged,
      repo.check('--all'),
      repo.check('--range', base, head),
      repo.checkInput(`refs/heads/feature ${head} refs/heads/staging ${base}\n`, '--push'),
    ]) {
      assert.equal(result.status, 0);
      assert.equal(result.diagnostic, '');
    }
    repo.write('assets/valid.png', 'const value = input as ' + 'a' + 'ny;\n');
    repo.git('add', '.');
    assert.equal(repo.check('--staged').status, 0);
    const renamed = repo.commit();
    assert.equal(repo.check('--range', head, renamed).status, 0);
    assert.equal(repo.check('--all').status, 0);
  });
}

for (const [label, content, status] of [
  ['pure repair rename', 'export {};\n'.repeat(10), 0],
  ['edited repair rename', 'export {};\n'.repeat(9) + 'export const value = 1;\n', 0],
  [
    'repair rename with violation',
    'export {};\n'.repeat(10) + 'host.' + 'inner' + 'HTML = value;\n',
    1,
  ],
]) {
  test(`${label} from an invalid target works in one commit`, (t) => {
    const repo = repository(t);
    repo.write('package.json', '{}');
    const base = repo.commit();
    writeIndexPath(
      repo,
      [...Buffer.from('src/caf'), 233, ...Buffer.from('.ts')],
      'export {};\n'.repeat(10),
    );
    const tree = repo.git('write-tree');
    const old = repo.git('commit-tree', tree, '-p', base, '-m', 'test: inherited byte path');
    repo.git('update-ref', 'HEAD', old);
    repo.write('src/renamed.ts', content);
    repo.git('add', '.');
    assert.equal(repo.check('--staged').status, status);
    const head = repo.commit();
    assert.equal(repo.check('--range', old, head).status, status);
    assert.equal(repo.check('--all').status, status);
    assert.equal(
      repo.checkInput(`refs/heads/feature ${head} refs/heads/staging ${old}\n`, '--push').status,
      status,
    );
  });
}
