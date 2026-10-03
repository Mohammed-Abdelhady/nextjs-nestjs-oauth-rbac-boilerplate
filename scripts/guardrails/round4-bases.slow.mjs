import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const source of ['upstream', 'origin/HEAD', 'origin/main']) {
  test(`closest manual base is selected from ${source}`, (t) => {
    const repo = repository(t);
    repo.write('src/a.ts', CLEAN);
    const old = repo.commit();
    repo.git('update-ref', 'refs/heads/main', old);
    repo.write('src/legacy.ts', BAD);
    const inherited = repo.commit();
    const ref = source === 'origin/main' ? 'refs/remotes/origin/main' : 'refs/remotes/origin/trunk';
    repo.git('update-ref', ref, inherited);
    if (source === 'origin/HEAD') repo.git('symbolic-ref', 'refs/remotes/origin/HEAD', ref);
    if (source === 'upstream') {
      repo.git('remote', 'add', 'origin', repo.root);
      repo.git('config', 'branch.feature.remote', 'origin');
      repo.git('config', 'branch.feature.merge', 'refs/heads/trunk');
    }
    repo.write('src/new.ts', CLEAN);
    repo.commit();
    assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
    repo.write('src/new-bad.ts', BAD);
    repo.commit();
    assert.deepEqual(outcome(repo.check('--push')), {
      status: 1,
      hits: [['src/new-bad.ts', 1, TOKEN]],
      caps: [],
    });
  });
}

test('multiple unrelated roots on trunk are legitimate history', (t) => {
  const repo = repository(t);
  repo.git('branch', '-m', 'trunk');
  repo.write('src/a.ts', CLEAN);
  repo.commit();
  repo.git('switch', '--orphan', 'other-root');
  repo.write('README.md', 'hosted repository\n');
  repo.commit();
  repo.git('switch', 'trunk');
  repo.git('merge', '--allow-unrelated-histories', '--no-edit', 'other-root');
  repo.git('branch', '-D', 'other-root');
  assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
});

test('unrelated configured upstream falls through to a shared candidate', (t) => {
  const repo = repository(t);
  repo.write('src/a.ts', CLEAN);
  const shared = repo.commit();
  repo.git('update-ref', 'refs/heads/main', shared);
  repo.git('switch', '--orphan', 'unrelated');
  repo.write('README.md', 'other history\n');
  const unrelated = repo.commit();
  repo.git('update-ref', 'refs/remotes/origin/trunk', unrelated);
  repo.git('switch', 'feature');
  repo.git('remote', 'add', 'origin', repo.root);
  repo.git('config', 'branch.feature.remote', 'origin');
  repo.git('config', 'branch.feature.merge', 'refs/heads/trunk');
  repo.write('src/new.ts', CLEAN);
  repo.commit();
  assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
});

test('manual multiple-root fallback checks content from every root', (t) => {
  const repo = repository(t);
  repo.git('branch', '-m', 'trunk');
  repo.write('src/root-a.ts', BAD);
  repo.commit();
  repo.git('switch', '--orphan', 'other-root');
  repo.write('src/root-b.ts', BAD);
  repo.commit();
  repo.git('switch', 'trunk');
  repo.git('merge', '--allow-unrelated-histories', '--no-edit', 'other-root');
  repo.git('branch', '-D', 'other-root');
  const result = outcome(repo.check('--push'));
  result.hits.sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(result, {
    status: 1,
    hits: [
      ['src/root-a.ts', 1, TOKEN],
      ['src/root-b.ts', 1, TOKEN],
    ],
    caps: [],
  });
});
