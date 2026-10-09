import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { copyFileSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { eventRange } from './event-range.mjs';
import { repository, installChecker } from '../guardrails/test-repository.mjs';

function fixture(t) {
  const repo = repository(t);
  installChecker(repo.root, { directory: 'scripts' });
  repo.write('scripts/ci/gates.json', '{"install":{},"gates":[]}');
  for (const file of [
    'ci.mjs',
    'ci/runner.mjs',
    'ci/range.mjs',
    'ci/event-range.mjs',
    'ci/cache.mjs',
    'ci/fetch.mjs',
  ]) {
    repo.write(`scripts/${file}`, '');
    copyFileSync(new URL(`../${file}`, import.meta.url), join(repo.root, 'scripts', file));
  }
  repo.write('src/feature.js', 'export const safe = true;\n');
  const base = repo.commit();
  repo.git('update-ref', 'refs/remotes/origin/staging', base);
  const token = 'inner' + 'HTML';
  repo.write('src/feature.js', `const host = {}; host.${token} = 'x';\n`);
  const head = repo.commit();
  const env = {
    ...repo.env,
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_PATH: join(repo.root, 'event.json'),
    GITHUB_SHA: head,
  };
  const event = (data) => writeFileSync(env.GITHUB_EVENT_PATH, JSON.stringify(data));
  const run = (...args) =>
    spawnSync(process.execPath, ['scripts/ci.mjs', ...args], {
      cwd: repo.root,
      env,
      encoding: 'utf8',
    });
  return { ...repo, base, head, env, event, run };
}

test('reads real event commits and catches a violation without dependencies or trusted hook refs', (t) => {
  const repo = fixture(t);
  repo.event({ before: repo.base, after: repo.head });
  repo.git('update-ref', 'refs/remotes/origin/forged', repo.head);
  repo.env.GIT_DIR = '/missing/repository';
  repo.env.GIT_INDEX_FILE = '/missing/index';
  assert.deepEqual(eventRange({ cwd: repo.root, env: repo.env }), {
    mode: 'range',
    base: repo.base,
    head: repo.head,
  });
  const result = repo.run('--range');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /src\/feature\.js:1: banned token/);
  assert.match(result.stdout, /\[ci\] Hard-ban range: exit 1/);
});

test('a PR scan uses base and head from its payload', (t) => {
  const repo = fixture(t);
  repo.env.GITHUB_EVENT_NAME = 'pull_request';
  repo.event({ pull_request: { base: { sha: repo.base }, head: { sha: repo.head } } });
  assert.deepEqual(eventRange({ cwd: repo.root, env: repo.env }), {
    mode: 'range',
    base: repo.base,
    head: repo.head,
  });
  assert.equal(repo.run('--range').status, 1);
});

test('new, missing-before and non-ancestor pushes use the fetched default merge base', (t) => {
  const repo = fixture(t);
  // A real sibling commit makes before resolvable but not an ancestor of head.
  const sibling = repo.git(
    'commit-tree',
    `${repo.base}^{tree}`,
    '-p',
    repo.base,
    '-m',
    'test: sibling',
  );
  for (const before of ['0'.repeat(40), undefined, sibling]) {
    repo.event({ before, after: repo.head, repository: { default_branch: 'staging' } });
    assert.deepEqual(eventRange({ cwd: repo.root, env: repo.env }), {
      mode: 'range',
      base: repo.base,
      head: repo.head,
    });
    assert.equal(repo.run('--range').status, 1);
  }
});

test('unavailable or empty fallback ranges scan the checked-out tree', (t) => {
  const repo = fixture(t);
  for (const defaultBranch of ['absent', 'staging']) {
    repo.git('update-ref', 'refs/remotes/origin/staging', repo.head);
    repo.event({ after: repo.head, repository: { default_branch: defaultBranch } });
    assert.deepEqual(eventRange({ cwd: repo.root, env: repo.env }), {
      mode: 'all',
      head: repo.head,
    });
    const result = repo.run('--range');
    assert.equal(result.status, 1);
    assert.match(result.stdout, /\[ci\] Hard-ban all: exit 1/);
  }
});

test('deleted refs have no content while bad invocations and stale checkouts fail closed', (t) => {
  const repo = fixture(t);
  repo.event({ deleted: true, after: '0'.repeat(40) });
  assert.equal(repo.run('--range').status, 0);
  repo.event({ after: repo.base });
  assert.equal(repo.run('--range').status, 2);
  assert.equal(repo.run('--unknown').status, 2);
  assert.equal(repo.run('--quality', 'extra').status, 2);
});

for (const name of ['space # project', 'percent% project']) {
  test(`the entry point runs from a directory named ${name}`, (t) => {
    const repo = fixture(t);
    const project = join(repo.root, name);
    mkdirSync(project);
    cpSync(join(repo.root, 'scripts'), join(project, 'scripts'), { recursive: true });
    const result = spawnSync(process.execPath, ['scripts/ci.mjs', '--unknown'], {
      cwd: project,
      env: repo.env,
      encoding: 'utf8',
    });
    assert.equal(result.status, 2);
  });
}
