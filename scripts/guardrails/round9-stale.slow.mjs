import assert from 'node:assert/strict';
import test from 'node:test';
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
} from './round8-hook-fixture.mjs';
import { outcome } from './test-repository.mjs';

for (const mode of ['existing', 'new', 'alias', 'union']) {
  test(`stale destination branch does not replace the actual remote ID: ${mode}`, (t) => {
    const repo = fixture(t);
    repo.git('branch', '-m', 'main');
    const origin = remote(t, repo, 'origin');
    repo.git('push', '-u', 'origin', 'main');
    const root = repo.git('rev-parse', 'HEAD');
    repo.git('switch', '-c', mode === 'existing' ? 'topic' : 'feat');
    repo.write('src/inherited.ts', BAD);
    const inherited = repo.commit();
    if (mode !== 'new') {
      repo.git('push', '-u', 'origin', mode === 'existing' ? 'topic:feat' : 'feat');
      origin.git('update-ref', 'refs/heads/feat', root);
    } else repo.git('update-ref', 'refs/remotes/origin/feat', inherited);
    if (mode === 'alias')
      repo.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/feat');
    if (mode === 'union') {
      repo.git('remote', 'add', 'backup', origin.root);
      repo.git('update-ref', 'refs/remotes/backup/feat', inherited);
    }
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    const result = push(
      repo,
      mode === 'union' ? origin.root : 'origin',
      mode === 'existing' ? 'topic:feat' : 'feat',
    );
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        gates: gates(repo),
        branch: received(origin, 'feat'),
      },
      {
        status: 1,
        hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
        gates: [],
        branch: mode === 'new' ? null : '1',
      },
    );
    repo.git('config', 'guardrails.pushBase', inherited);
    const trusted = push(repo, 'origin', mode === 'existing' ? 'topic:feat' : 'feat');
    assert.deepEqual(
      {
        status: trusted.status,
        hits: trusted.hits,
        gates: gates(repo),
        branch: received(origin, 'feat'),
      },
      { status: 0, hits: [], gates: GATES, branch: '3' },
    );
  });
}

test('matching destination tracking and actual remote ID preserve known history', (t) => {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  const origin = remote(t, repo, 'origin');
  repo.git('push', 'origin', 'main');
  repo.git('switch', '-c', 'feat');
  repo.write('src/inherited.ts', BAD);
  repo.commit();
  repo.git('push', '-u', 'origin', 'feat');
  repo.write('src/clean.ts', CLEAN);
  repo.commit();
  const result = push(repo, 'origin', 'feat');
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      gates: gates(repo),
      branch: received(origin, 'feat'),
    },
    { status: 0, hits: [], gates: GATES, branch: '3' },
  );
});

test('multiple updates block only their corresponding stale tracking refs', (t) => {
  const repo = fixture(t);
  repo.git('branch', '-m', 'main');
  remote(t, repo, 'origin');
  repo.git('push', 'origin', 'main');
  const root = repo.git('rev-parse', 'HEAD');
  repo.git('switch', '-c', 'feat');
  repo.write('src/inherited.ts', BAD);
  const inherited = repo.commit();
  repo.git('update-ref', 'refs/remotes/origin/feat', inherited);
  repo.git('switch', '-c', 'other', 'main');
  repo.write('src/other.ts', BAD);
  const other = repo.commit();
  repo.git('update-ref', 'refs/remotes/origin/other', other);
  const result = repo.checkInput(
    `refs/heads/feat ${inherited} refs/heads/feat ${ZERO}\nrefs/heads/other ${other} refs/heads/other ${other}\n`,
    '--push',
    '--hook',
    'origin',
  );
  assert.deepEqual(outcome(result), {
    status: 1,
    hits: [['src/inherited.ts', 1, TOKEN]],
    caps: [],
  });
  assert.equal(result.diagnostic.includes(`[${inherited.slice(0, 7)}]`), true);
  assert.equal(result.diagnostic.includes(`[${root.slice(0, 7)}]`), false);
});
