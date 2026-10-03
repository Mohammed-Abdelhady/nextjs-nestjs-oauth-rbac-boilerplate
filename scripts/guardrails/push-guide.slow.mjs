import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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

for (const state of ['missing', 'dangling']) {
  test(`the documented repair restores a ${state} default HEAD baseline`, (t) => {
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
    origin.git('symbolic-ref', 'HEAD', 'refs/heads/develop');
    if (state === 'dangling')
      repo.git('symbolic-ref', 'refs/remotes/origin/HEAD', 'refs/remotes/origin/gone');
    repo.git('switch', '-c', 'mine', '--no-track');
    repo.write('src/clean.ts', CLEAN);
    repo.commit();
    const refused = push(repo, 'fork', 'mine');
    assert.deepEqual(
      {
        status: refused.status,
        hits: refused.hits,
        gates: gates(repo),
        branch: received(fork, 'mine'),
      },
      {
        status: 1,
        hits: [[inherited.slice(0, 7), 'src/inherited.ts', 1, TOKEN]],
        gates: [],
        branch: null,
      },
    );
    const guide = readFileSync(new URL('../../docs/code-quality.md', import.meta.url), 'utf8');
    const command = [...guide.matchAll(/`git ([^`]+)`/g)]
      .map((match) => match[1].split(/\s+/))
      .find((args) => args[0] === 'remote' && args[1] === 'set-head' && args[2] === 'origin');
    assert.ok(command, 'The guide must supply an executable default-HEAD repair.');
    repo.git(...command);
    const accepted = push(repo, 'fork', 'mine');
    assert.deepEqual(
      {
        status: accepted.status,
        hits: accepted.hits,
        gates: gates(repo),
        branch: received(fork, 'mine'),
      },
      { status: 0, hits: [], gates: GATES, branch: '3' },
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
        branch: '3',
      },
    );
  });
}
