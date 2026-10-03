import assert from 'node:assert/strict';
import test from 'node:test';
import { repository } from './test-repository.mjs';
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

function contribution(t) {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  const origin = remote(t, repo, 'origin');
  const fork = remote(t, repo, 'fork');
  repo.git('push', '-u', 'origin', 'main');
  repo.git('push', 'fork', 'main');
  repo.git('switch', '-c', 'work');
  repo.write('src/inherited.ts', BAD);
  const inherited = repo.commit();
  repo.git('push', '-u', 'fork', 'work');
  repo.git('fetch', 'fork');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  return { repo, origin, fork, inherited };
}

for (const configured of [undefined, '', 'fork']) {
  test(`unknown URL trusts only opted-in remote history: ${String(configured)}`, (t) => {
    const { repo, inherited } = contribution(t);
    repo.git('branch', '--unset-upstream');
    const target = repository(t, ['--bare']);
    if (configured !== undefined) repo.git('config', 'guardrails.trustedRemotes', configured);
    const result = push(repo, target.root, 'work');
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        branch: received(target, 'work'),
      },
      configured === 'fork'
        ? { status: 0, hits: [], gates: GATES, branch: '3' }
        : {
            status: 1,
            hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
            gates: [],
            branch: null,
          },
    );
    if (configured === 'fork') {
      repo.write('src/own.ts', BAD);
      const own = repo.commit();
      const dirty = push(repo, target.root, 'work');
      assert.deepEqual(
        {
          status: dirty.status,
          hits: dirty.hits,
          gates: gates(repo),
          branch: received(target, 'work'),
        },
        { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 1, TOKEN]], gates: GATES, branch: '3' },
      );
    }
  });
}

for (const values of [
  ['origin,fork'],
  ['origin, fork,'],
  ['origin\tfork\norigin'],
  ['origin', 'fork'],
  ['fork', 'origin'],
  ['fork', 'fork'],
]) {
  test(`configured trust unions every list value: ${JSON.stringify(values)}`, (t) => {
    const { repo, origin } = contribution(t);
    for (const value of values) repo.git('config', '--add', 'guardrails.trustedRemotes', value);
    const clean = push(repo, 'origin', 'work');
    assert.deepEqual(
      {
        status: clean.status,
        hits: clean.hits,
        gates: gates(repo),
        branch: received(origin, 'work'),
      },
      { status: 0, hits: [], gates: GATES, branch: '3' },
    );
    repo.write('src/own.ts', BAD);
    const own = repo.commit();
    const dirty = push(repo, 'origin', 'work');
    assert.deepEqual(
      {
        status: dirty.status,
        hits: dirty.hits,
        gates: gates(repo),
        branch: received(origin, 'work'),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 1, TOKEN]], gates: GATES, branch: '3' },
    );
  });
}

for (const value of ['ghost ghost,ghost', 'https://fixture:fixture-secret@example.invalid/repo']) {
  test(`unknown configured names warn once and never establish trust: ${value.startsWith('https:') ? 'credential' : 'repeated'}`, (t) => {
    const { repo, origin, inherited } = contribution(t);
    repo.git('config', 'guardrails.trustedRemotes', value);
    const result = push(repo, 'origin', 'work');
    const warnings = result.diagnostic
      .split('\n')
      .filter((line) => line.startsWith('warning:') && line.includes('guardrails.trustedRemotes'));
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        branch: received(origin, 'work'),
        warnings: warnings.length,
        leaksCredential: result.diagnostic.includes('fixture-secret'),
      },
      {
        status: 1,
        hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
        gates: [],
        branch: null,
        warnings: 1,
        leaksCredential: false,
      },
    );
  });
}

test('orphan originX tracking never belongs to configured origin', (t) => {
  const { repo, origin, inherited } = contribution(t);
  repo.git('branch', '--unset-upstream');
  repo.git('update-ref', 'refs/remotes/originX/work', inherited);
  const result = push(repo, 'origin', 'work');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(origin, 'work'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
      gates: [],
      branch: null,
    },
  );
});
