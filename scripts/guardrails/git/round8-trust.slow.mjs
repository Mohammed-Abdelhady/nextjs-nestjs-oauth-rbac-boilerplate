import assert from 'node:assert/strict';
import test from 'node:test';
import { repository } from '../test-repository.mjs';
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
  triangular,
} from './round8-hook-fixture.mjs';

function contribution(t, child, forkName = 'fork') {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  const destination = remote(t, repo, 'origin');
  const fork = forkName === 'fork' ? remote(t, repo, 'fork') : repository(t, ['--bare']);
  if (forkName !== 'fork') {
    repo.git('config', `remote.${forkName}.url`, fork.root);
    repo.git('config', `remote.${forkName}.fetch`, `+refs/heads/*:refs/remotes/${forkName}/*`);
  }
  repo.git('push', '-u', 'origin', 'main');
  repo.git('push', forkName, 'main');
  const author = repository(t);
  author.git('fetch', fork.root, 'main');
  author.git('reset', '--hard', 'FETCH_HEAD');
  author.write('src/inherited.ts', CLEAN + BAD);
  const inherited = author.commit();
  author.git('push', fork.root, 'HEAD:contrib');
  repo.git('fetch', forkName);
  repo.git('switch', '-c', 'pr', '--no-track', `${forkName}/contrib`);
  repo.git('config', 'branch.pr.remote', forkName);
  repo.git('config', 'branch.pr.merge', 'refs/heads/contrib');
  if (child) {
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
  }
  return { repo, destination, fork, inherited };
}

for (const child of [false, true]) {
  for (const destinationKind of ['name', 'URL']) {
    test(`a fork contribution upstream is not trusted by origin, child=${child}, destination=${destinationKind}`, (t) => {
      const { repo, destination, inherited } = contribution(t, child);
      const result = push(repo, destinationKind === 'name' ? 'origin' : destination.root, 'pr');
      assert.deepEqual(
        {
          status: result.status,
          hits: result.hits,
          gates: gates(repo),
          branch: received(destination, 'pr'),
          main: received(destination, 'main'),
        },
        {
          status: 1,
          hits: [[inherited.slice(0, 7), 'src/inherited.ts', 2, TOKEN]],
          gates: [],
          branch: null,
          main: '1',
        },
      );
    });
  }
}

for (const trusted of ['fork', 'origin fork', '  fork\torigin  ']) {
  test(`explicit trustedRemotes=${trusted} permits fork ancestry while checking own children`, (t) => {
    const { repo, destination } = contribution(t, true);
    repo.git('config', 'guardrails.trustedRemotes', trusted);
    const clean = push(repo, 'origin', 'pr');
    assert.deepEqual(
      {
        status: clean.status,
        hits: clean.hits,
        gates: gates(repo),
        branch: received(destination, 'pr'),
      },
      { status: 0, hits: [], gates: GATES, branch: '3' },
    );
    repo.write('src/own.ts', CLEAN + BAD);
    const own = repo.commit();
    const dirty = push(repo, 'origin', 'pr');
    assert.deepEqual(
      {
        status: dirty.status,
        hits: dirty.hits,
        gates: gates(repo),
        branch: received(destination, 'pr'),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 2, TOKEN]], gates: GATES, branch: '3' },
    );
  });
}

test('an explicitly empty trustedRemotes list replaces default origin trust', (t) => {
  const { repo, fork } = triangular(t);
  const inherited = repo.git('rev-parse', 'origin/trunk');
  repo.git('switch', '-c', 'topic', '--track', 'origin/trunk');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  repo.git('config', 'guardrails.trustedRemotes', '');
  const result = push(repo, 'fork', 'topic');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(fork, 'topic'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
      gates: [],
      branch: null,
    },
  );
});

test('a fork-only dirty main pulled into local main remains checked at origin', (t) => {
  const { repo, destination, inherited } = contribution(t, false);
  repo.git('switch', 'main');
  repo.git('merge', '--ff-only', 'fork/contrib');
  repo.git('switch', '-c', 'feat');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  const result = push(repo, 'origin', 'feat');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(destination, 'feat'),
      main: received(destination, 'main'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 2, TOKEN]],
      gates: [],
      branch: null,
      main: '1',
    },
  );
});

test('the destination itself trusts its contribution history even when extra trust is empty', (t) => {
  const { repo, fork } = contribution(t, true);
  repo.git('config', 'guardrails.trustedRemotes', '');
  const result = push(repo, 'fork', 'pr');
  assert.deepEqual(
    { status: result.status, hits: result.hits, gates: gates(repo), branch: received(fork, 'pr') },
    { status: 0, hits: [], gates: GATES, branch: '3' },
  );
});

test('the longest configured remote owner prevents origin from trusting origin/nested', (t) => {
  const { repo, destination, inherited } = contribution(t, true, 'origin/nested');
  const refused = push(repo, 'origin', 'pr');
  assert.deepEqual(
    {
      status: refused.status,
      hits: refused.hits,
      gates: gates(repo),
      branch: received(destination, 'pr'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 2, TOKEN]],
      gates: [],
      branch: null,
    },
  );
  repo.git('config', 'guardrails.trustedRemotes', 'origin/nested');
  const clean = push(repo, 'origin', 'pr');
  assert.deepEqual(
    {
      status: clean.status,
      hits: clean.hits,
      gates: gates(repo),
      branch: received(destination, 'pr'),
    },
    { status: 0, hits: [], gates: GATES, branch: '3' },
  );
  repo.write('src/own.ts', CLEAN + BAD);
  const own = repo.commit();
  const dirty = push(repo, 'origin', 'pr');
  assert.deepEqual(
    {
      status: dirty.status,
      hits: dirty.hits,
      gates: gates(repo),
      branch: received(destination, 'pr'),
    },
    { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 2, TOKEN]], gates: GATES, branch: '3' },
  );
});

test('the current branch upstream cannot establish a baseline for another pushed branch', (t) => {
  const { repo, fork } = triangular(t);
  const inherited = repo.git('rev-parse', 'origin/trunk');
  repo.git('switch', '-c', 'feat', '--no-track');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  repo.git('switch', 'trunk');
  const result = push(repo, 'fork', 'feat');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(fork, 'feat'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
      gates: [],
      branch: null,
    },
  );
});

for (const [branch, count] of [
  ['main', '2'],
  ['feat', '3'],
]) {
  test(`fork sync trusts origin tracking for ${branch} and still checks later own commits`, (t) => {
    const { repo, fork } = triangular(t, 'main');
    if (branch === 'feat') {
      repo.git('switch', '-c', 'feat', '--no-track');
      repo.write('src/clean.ts', CLEAN);
      repo.commit();
    }
    const clean = push(repo, 'fork', branch === 'main' ? 'origin/main:main' : branch);
    assert.deepEqual(
      {
        status: clean.status,
        hits: clean.hits,
        gates: gates(repo),
        branch: received(fork, branch),
      },
      { status: 0, hits: [], gates: GATES, branch: count },
    );
    repo.write('src/own.ts', CLEAN + BAD);
    const own = repo.commit();
    const dirty = push(repo, 'fork', branch);
    assert.deepEqual(
      {
        status: dirty.status,
        hits: dirty.hits,
        gates: gates(repo),
        branch: received(fork, branch),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 2, TOKEN]], gates: GATES, branch: count },
    );
  });
}
