import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BAD,
  CLEAN,
  TOKEN,
  fixture,
  gates,
  installHooks,
  push,
  received,
  remote,
} from './round8-hook-fixture.mjs';

function origin(t, options) {
  const repo = fixture(t, options);
  repo.git('branch', '-m', 'main');
  const target = remote(t, repo, 'origin');
  repo.git('push', '-u', 'origin', 'main');
  return { repo, target };
}

for (const [local, upstream, sameTip] of [
  ['dev', true, false],
  ['dev', false, false],
  ['main', false, false],
  ['staging', false, false],
  ['master', false, false],
  ['develop', false, false],
  ['main', false, true],
]) {
  test(`local ${local} is never an implicit hook baseline, upstream=${upstream}, sameTip=${sameTip}`, (t) => {
    const { repo, target } = origin(t);
    if (local !== 'main') repo.git('switch', '-c', local);
    repo.write('src/own.ts', CLEAN + BAD);
    const dirty = repo.commit();
    repo.git('switch', '-c', 'feat');
    if (upstream) repo.git('branch', '--set-upstream-to', local);
    if (!sameTip) {
      repo.write('src/clean.ts', CLEAN);
      repo.commit();
    }
    const result = push(repo, 'origin', 'feat');
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        branch: received(target, 'feat'),
        main: received(target, 'main'),
      },
      {
        status: 1,
        hits: [[dirty.slice(0, 7), 'src/own.ts', 2, TOKEN]],
        gates: [],
        branch: null,
        main: '1',
      },
    );
  });
}

for (const [label, args] of [
  ['HEAD', ['HEAD']],
  ['explicit HEAD refspec', ['HEAD:refs/heads/x']],
  ['revision expression', ['feat~0:refs/heads/y']],
  ['lightweight tag', ['v9']],
  ['annotated tag', ['v9']],
  ['detached HEAD', ['HEAD:refs/heads/d']],
  ['multiple branches', ['main', 'feat']],
]) {
  test(`an inherited local violation remains checked through ${label}`, (t) => {
    const { repo, target } = origin(t);
    repo.write('src/own.ts', CLEAN + BAD);
    const dirty = repo.commit();
    repo.git('switch', '-c', 'feat');
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    if (label === 'lightweight tag') repo.git('tag', 'v9');
    if (label === 'annotated tag') repo.git('tag', '-a', 'v9', '-m', 'test: tag');
    if (label === 'detached HEAD') repo.git('switch', '--detach');
    const result = push(repo, 'origin', ...args);
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        refs: target.git('for-each-ref', '--format=%(refname)'),
        main: received(target, 'main'),
      },
      {
        status: 1,
        hits: [[dirty.slice(0, 7), 'src/own.ts', 2, TOKEN]],
        gates: [],
        refs: 'refs/heads/main',
        main: '1',
      },
    );
  });
}

test('main~1 checks the selected dirty commit even when local main contains a later dirty tip', (t) => {
  const { repo, target } = origin(t);
  repo.write('src/one.ts', CLEAN + BAD);
  const first = repo.commit();
  repo.write('src/two.ts', BAD);
  repo.commit();
  const result = push(repo, 'origin', 'main~1:refs/heads/z');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(target, 'z'),
      main: received(target, 'main'),
    },
    {
      status: 1,
      hits: [[first.slice(0, 7), 'src/one.ts', 2, TOKEN]],
      gates: [],
      branch: null,
      main: '1',
    },
  );
});

test('a violation committed before hook installation is refused through a clean child', (t) => {
  const { repo, target } = origin(t, { hooks: false });
  repo.write('src/own.ts', CLEAN + BAD);
  const dirty = repo.commit();
  installHooks(repo);
  repo.git('switch', '-c', 'feat');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  const result = push(repo, 'origin', 'feat');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(target, 'feat'),
      main: received(target, 'main'),
    },
    {
      status: 1,
      hits: [[dirty.slice(0, 7), 'src/own.ts', 2, TOKEN]],
      gates: [],
      branch: null,
      main: '1',
    },
  );
});
