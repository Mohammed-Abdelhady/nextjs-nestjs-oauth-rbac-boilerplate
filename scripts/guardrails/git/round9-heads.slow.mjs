import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BAD,
  CLEAN,
  GATES,
  TOKEN,
  fixture,
  gates,
  push,
  received,
  remote,
} from './round8-hook-fixture.mjs';

for (const [history, owner] of [
  ['merge', 'origin'],
  ['rebase', 'origin'],
  ['merge', 'upstream'],
]) {
  test(`trusted nonstandard ${owner} HEAD permits inherited ${history} and checks own children`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'main');
    const origin = remote(t, repo, owner);
    const fork = remote(t, repo, 'fork');
    repo.git('push', '-u', owner, 'main');
    if (owner === 'upstream') repo.git('config', 'guardrails.trustedRemotes', 'upstream');
    repo.git('push', 'fork', 'main');
    repo.git('switch', '-c', 'mine');
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    repo.git('push', '-u', 'fork', 'mine');
    repo.git('switch', '-c', 'develop', 'main');
    repo.write('src/inherited.ts', BAD);
    repo.commit();
    repo.git('push', owner, 'develop');
    repo.git('fetch', owner);
    repo.git('symbolic-ref', `refs/remotes/${owner}/HEAD`, `refs/remotes/${owner}/develop`);
    repo.git('switch', 'mine');
    if (history === 'merge') repo.git('merge', '--no-ff', '--no-edit', `${owner}/develop`);
    else repo.git('rebase', `${owner}/develop`);
    const clean =
      history === 'rebase'
        ? push(repo, '--force-with-lease', 'fork', 'mine')
        : push(repo, 'fork', 'mine');
    assert.deepEqual(
      {
        status: clean.status,
        hits: clean.hits,
        gates: gates(repo),
        branch: received(fork, 'mine'),
      },
      { status: 0, hits: [], gates: GATES, branch: history === 'merge' ? '4' : '3' },
    );
    repo.write('src/own.ts', BAD);
    const own = repo.commit();
    const dirty = push(repo, 'fork', 'mine');
    assert.deepEqual(
      {
        status: dirty.status,
        hits: dirty.hits,
        gates: gates(repo),
        branch: received(fork, 'mine'),
      },
      {
        status: 1,
        hits: [[own.slice(0, 7), 'src/own.ts', 1, TOKEN]],
        gates: GATES,
        branch: history === 'merge' ? '4' : '3',
      },
    );
  });
}

for (const [target, destination] of [
  ['refs/heads/main', 'fork'],
  ['refs/remotes/outsider/evil', 'fork'],
  ['refs/remotes/origin/missing', 'fork'],
  ['refs/heads/main', 'origin'],
]) {
  test(`default HEAD cannot confer trust through ${target} at ${destination}`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'main');
    const origin = remote(t, repo, 'origin');
    const fork = remote(t, repo, 'fork');
    repo.git('push', 'origin', 'main');
    repo.git('push', 'fork', 'main');
    repo.write('src/inherited.ts', BAD);
    const inherited = repo.commit();
    remote(t, repo, 'outsider');
    repo.git('update-ref', 'refs/remotes/outsider/evil', inherited);
    repo.git('symbolic-ref', 'refs/remotes/origin/HEAD', target);
    repo.git('switch', '-c', 'mine');
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    const result = push(repo, destination, 'mine');
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        branch: received(destination === 'fork' ? fork : origin, 'mine'),
      },
      {
        status: 1,
        hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
        gates: [],
        branch: null,
      },
    );
  });
}

test('a destination HEAD is not an implicit trusted default source', (t) => {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  const origin = remote(t, repo, 'origin');
  const fork = remote(t, repo, 'fork');
  repo.git('push', 'origin', 'main');
  repo.git('push', 'fork', 'main');
  repo.git('switch', '-c', 'develop');
  repo.write('src/inherited.ts', BAD);
  const inherited = repo.commit();
  repo.git('push', 'origin', 'develop');
  repo.git('symbolic-ref', 'refs/remotes/fork/HEAD', 'refs/remotes/origin/develop');
  repo.git('switch', '--no-track', '-c', 'pub', 'origin/develop');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  const refused = push(repo, 'fork', 'pub');
  assert.deepEqual(
    {
      status: refused.status,
      hits: refused.hits,
      gates: gates(repo),
      branch: received(fork, 'pub'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
      gates: [],
      branch: null,
    },
  );
  repo.git('config', 'guardrails.trustedRemotes', 'origin fork');
  const accepted = push(repo, 'fork', 'pub');
  assert.deepEqual(
    {
      status: accepted.status,
      hits: accepted.hits,
      gates: gates(repo),
      branch: received(fork, 'pub'),
    },
    { status: 0, hits: [], gates: GATES, branch: '3' },
  );
  repo.write('src/own.ts', BAD);
  const own = repo.commit();
  const dirty = push(repo, 'fork', 'pub');
  assert.deepEqual(
    {
      status: dirty.status,
      hits: dirty.hits,
      gates: gates(repo),
      branch: received(fork, 'pub'),
    },
    { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 1, TOKEN]], gates: GATES, branch: '3' },
  );
});
