import assert from 'node:assert/strict';
import test from 'node:test';
import { repository, outcome } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

for (const scenario of ['root', 'second commit', 'detached', 'fresh remote', 'new branch']) {
  test(`first push excludes inherited content: ${scenario}`, (t) => {
    const repo = repository(t);
    repo.write('src/old.ts', BAD);
    repo.commit();
    if (scenario !== 'root') {
      repo.write('src/new.ts', CLEAN);
      repo.commit();
    }
    if (scenario === 'detached')
      repo.git('update-ref', '--no-deref', 'HEAD', repo.git('rev-parse', 'feature'));
    if (scenario === 'fresh remote') repo.git('remote', 'add', 'origin', repo.root + '/absent.git');
    if (scenario === 'new branch') {
      repo.git('branch', 'main');
      repo.git('symbolic-ref', 'HEAD', 'refs/heads/new-feature');
      repo.commit();
    }
    assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
  });
}

for (const ref of [
  'refs/heads/main',
  'refs/heads/master',
  'refs/heads/staging',
  'refs/remotes/origin/main',
  'refs/remotes/origin/master',
  'refs/remotes/origin/staging',
]) {
  test(`push uses candidate merge base: ${ref}`, (t) => {
    const repo = repository(t);
    repo.write('src/old.ts', BAD);
    repo.commit();
    repo.write('src/old.ts', BAD + BAD);
    const base = repo.commit();
    repo.git('update-ref', ref, base);
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
  });
}

for (const mode of ['range', 'upstream', 'candidate']) {
  test(`${mode} scans merge base rather than the diverged tip`, (t) => {
    const repo = repository(t);
    repo.write('src/old.ts', BAD);
    const root = repo.commit();
    repo.write('src/old.ts', CLEAN);
    const base = repo.commit();
    repo.git('update-ref', 'refs/heads/feature', root);
    repo.write('src/old.ts', BAD);
    repo.write('src/clean.ts', CLEAN);
    const head = repo.commit();
    if (mode === 'upstream') {
      repo.git('update-ref', 'refs/heads/base', base);
      repo.git('config', 'branch.feature.remote', '.');
      repo.git('config', 'branch.feature.merge', 'refs/heads/base');
    }
    if (mode === 'candidate') repo.git('update-ref', 'refs/heads/main', base);
    const args = mode === 'range' ? ['--range', base, head] : ['--push'];
    assert.deepEqual(outcome(repo.check(...args)), { status: 0, hits: [], caps: [] });
    repo.write('src/added.ts', BAD);
    const badHead = repo.commit();
    assert.deepEqual(
      outcome(repo.check(...(mode === 'range' ? ['--range', base, badHead] : args))),
      {
        status: 1,
        hits: [['src/added.ts', 1, TOKEN]],
        caps: [],
      },
    );
  });
}

test('range refuses an extra argument after valid commits', (t) => {
  const repo = repository(t);
  repo.write('src/a.ts', CLEAN);
  const base = repo.commit();
  repo.write('src/a.ts', CLEAN + CLEAN);
  const head = repo.commit();
  assert.equal(repo.check('--range', base, head, 'extra').status, 2);
});

test('scanned rename retains added-line scope even when config disables rename detection', (t) => {
  const repo = repository(t);
  repo.write('src/old.ts', BAD + CLEAN.repeat(10));
  const base = repo.commit();
  repo.git('config', 'diff.renames', 'false');
  repo.git('mv', 'src/old.ts', 'src/new.ts');
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), { status: 0, hits: [], caps: [] });
  const head = repo.commit();
  assert.deepEqual(outcome(repo.check('--range', base, head)), { status: 0, hits: [], caps: [] });
});

for (const branch of ['main', 'master', 'staging']) {
  test(`current primary branch excludes only inherited root lines: ${branch}`, (t) => {
    const repo = repository(t);
    repo.write('src/old.ts', BAD);
    const root = repo.commit();
    repo.git('update-ref', `refs/heads/${branch}`, root);
    repo.git('symbolic-ref', 'HEAD', `refs/heads/${branch}`);
    assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    assert.deepEqual(outcome(repo.check('--push')), { status: 0, hits: [], caps: [] });
    repo.write('src/new.ts', BAD);
    repo.commit();
    assert.deepEqual(outcome(repo.check('--push')), {
      status: 1,
      hits: [['src/new.ts', 1, TOKEN]],
      caps: [],
    });
  });
}
