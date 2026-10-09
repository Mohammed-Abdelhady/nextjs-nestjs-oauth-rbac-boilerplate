import assert from 'node:assert/strict';
import test from 'node:test';
import { outcome, repository } from '../test-repository.mjs';
import {
  BAD,
  CLEAN,
  GATES,
  TOKEN,
  ZERO,
  fixture,
  gates,
  push,
  received,
  remote,
  triangular,
} from './round8-hook-fixture.mjs';

for (const setting of ['remote.pushDefault', 'branch.topic.pushRemote']) {
  test(`a stale triangular fork uses the pushed branch upstream with ${setting}`, (t) => {
    const { repo, fork } = triangular(t);
    repo.git('switch', '-c', 'topic', '--track', 'origin/trunk');
    repo.git('config', setting, 'fork');
    repo.git('config', 'push.default', 'current');
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    const clean = push(repo);
    assert.deepEqual(
      {
        status: clean.status,
        hits: clean.hits,
        gates: gates(repo),
        received: received(fork, 'topic'),
      },
      { status: 0, hits: [], gates: GATES, received: '3' },
    );
    repo.write('src/own.ts', CLEAN + BAD);
    const own = repo.commit();
    const dirty = push(repo);
    assert.deepEqual(
      {
        status: dirty.status,
        hits: dirty.hits,
        gates: gates(repo),
        received: received(fork, 'topic'),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 2, TOKEN]], gates: GATES, received: '3' },
    );
  });
}

test('pushing another branch reads that branch upstream rather than the checked-out branch', (t) => {
  const { repo, fork, root } = triangular(t);
  repo.git('switch', '-c', 'topic', '--track', 'origin/trunk');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  repo.git('switch', '-c', 'unrelated', root);
  const result = push(repo, 'fork', 'topic');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      received: received(fork, 'topic'),
    },
    { status: 0, hits: [], gates: GATES, received: '3' },
  );
});

test('a local staging pushBase opt-in accepts inherited history and still checks own children', (t) => {
  const { repo, fork } = triangular(t, 'staging');
  repo.git('switch', '-c', 'topic', '--no-track', 'origin/staging');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  repo.git('config', 'guardrails.trustedRemotes', '');
  const inherited = repo.git('rev-parse', 'origin/staging');
  const refused = push(repo, 'fork', 'topic');
  assert.deepEqual(
    {
      status: refused.status,
      hits: refused.hits,
      gates: gates(repo),
      received: received(fork, 'topic'),
    },
    {
      status: 1,
      hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
      gates: [],
      received: null,
    },
  );
  repo.git('config', 'guardrails.pushBase', 'staging');
  const result = push(repo, 'fork', 'topic');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      received: received(fork, 'topic'),
    },
    { status: 0, hits: [], gates: GATES, received: '3' },
  );
  repo.write('src/own.ts', CLEAN + BAD);
  const own = repo.commit();
  const dirty = push(repo, 'fork', 'topic');
  assert.deepEqual(
    {
      status: dirty.status,
      hits: dirty.hits,
      gates: gates(repo),
      received: received(fork, 'topic'),
    },
    { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 2, TOKEN]], gates: GATES, received: '3' },
  );
});

test('a pushed primary branch tip cannot become its own standard baseline', (t) => {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  const destination = remote(t, repo, 'primary');
  repo.git('push', 'primary', 'main');
  repo.write('src/own.ts', BAD);
  const own = repo.commit();
  const result = push(repo, 'primary', 'main');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      received: received(destination, 'main'),
    },
    { status: 1, hits: [[own.slice(0, 7), 'src/own.ts', 1, TOKEN]], gates: [], received: '1' },
  );
});

for (const sharedUrl of [false, true]) {
  test(`real pre-push keeps the primary destination name, shared URL=${sharedUrl}`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'topic');
    const primary = remote(t, repo, 'primary');
    remote(t, repo, 'origin', sharedUrl ? primary.root : undefined);
    repo.git('push', 'primary', 'topic');
    repo.write('src/only-other.ts', BAD);
    const own = repo.commit();
    repo.git('push', 'origin', 'HEAD:side');
    repo.git('branch', '--track', 'other', 'origin/side');
    const result = push(repo, 'primary', 'topic');
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        received: received(primary, 'topic'),
      },
      {
        status: 1,
        hits: [[own.slice(0, 7), 'src/only-other.ts', 1, TOKEN]],
        gates: [],
        received: '1',
      },
    );
  });
}

for (const urlKind of ['fetch', 'push']) {
  test(`a configured ${urlKind} URL preserves destination isolation`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'topic');
    const target = repository(t, ['--bare']);
    if (urlKind === 'fetch') repo.git('remote', 'add', 'primary', target.root);
    else {
      remote(t, repo, 'primary');
      repo.git('config', 'remote.primary.pushurl', target.root);
    }
    remote(t, repo, 'origin');
    repo.git(
      'config',
      'remote.aaa-incomplete.fetch',
      '+refs/heads/*:refs/remotes/aaa-incomplete/*',
    );
    repo.git('push', 'primary', 'topic');
    if (urlKind === 'fetch') {
      const distinctPush = repository(t, ['--bare']);
      repo.git('config', 'remote.primary.pushurl', distinctPush.root);
    }
    repo.write('src/url.ts', BAD);
    const own = repo.commit();
    repo.git('push', 'origin', 'HEAD:side');
    const result = push(repo, target.root, 'topic');
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        received: received(target, 'topic'),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/url.ts', 1, TOKEN]], gates: [], received: '1' },
    );
    const record = `refs/heads/topic ${own} refs/heads/topic ${ZERO}\n`;
    for (const unknown of [target.root.slice(0, -4), target.root + '-unknown']) {
      assert.deepEqual(outcome(repo.checkInput(record, '--push', '--hook', unknown)), {
        status: 0,
        hits: [],
        caps: [],
      });
    }
  });
}

for (const refspec of ['main', 'HEAD:refs/heads/topic', 'main~0:refs/heads/topic']) {
  test(`first dirty root push cannot self-baseline through ${refspec}`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'main');
    repo.write('src/root.ts', BAD);
    repo.git('add', '.');
    repo.git('commit', '--amend', '--no-edit');
    const own = repo.git('rev-parse', 'HEAD');
    const target = remote(t, repo, 'primary');
    const result = push(repo, 'primary', refspec);
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        refs: target.git('for-each-ref', '--format=%(refname)'),
      },
      { status: 1, hits: [[own.slice(0, 7), 'src/root.ts', 1, TOKEN]], gates: [], refs: '' },
    );
  });
}

test('a clean HEAD refspec resolves the pushed current branch upstream', (t) => {
  const { repo, fork } = triangular(t);
  repo.git('switch', '-c', 'topic', '--track', 'origin/trunk');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  const result = push(repo, 'fork', 'HEAD:refs/heads/head-topic');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      received: received(fork, 'head-topic'),
    },
    { status: 0, hits: [], gates: GATES, received: '3' },
  );
});

test('a cached main hook update remains checked after its local branch advances', (t) => {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  repo.write('src/own.ts', BAD);
  const dirty = repo.commit();
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  const record = `refs/heads/main ${dirty} refs/heads/main ${ZERO}\n`;
  const result = repo.checkInput(record, '--push', '--hook', 'unknown');
  assert.deepEqual(outcome(result), { status: 1, hits: [['src/own.ts', 1, TOKEN]], caps: [] });
  const lines = result.diagnostic.trim().split('\n').filter(Boolean);
  const ban = lines.find((line) => line.includes(': banned token '));
  assert.equal(ban?.startsWith(`[${dirty.slice(0, 7)}] src/own.ts:1:`), true);
  assert.deepEqual(
    {
      warnings: lines.filter((line) => line.includes('guardrails.trustedRemotes')).length,
      lines: lines.length,
    },
    { warnings: 0, lines: 1 },
  );
});

test('a local main alias cannot hide a dirty pushed feature root', (t) => {
  const repo = fixture(t);
  repo.git('branch', '-m', 'feature');
  repo.write('src/root.ts', BAD);
  repo.git('add', '.');
  repo.git('commit', '--amend', '--no-edit');
  const dirty = repo.git('rev-parse', 'HEAD');
  repo.git('branch', 'main');
  const target = remote(t, repo, 'primary');
  const result = push(repo, 'primary', 'feature');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      refs: target.git('for-each-ref', '--format=%(refname)'),
    },
    { status: 1, hits: [[dirty.slice(0, 7), 'src/root.ts', 1, TOKEN]], gates: [], refs: '' },
  );
});
