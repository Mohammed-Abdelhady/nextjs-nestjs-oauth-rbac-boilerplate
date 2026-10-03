import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, symlinkSync, renameSync } from 'node:fs';
import { join, relative, basename } from 'node:path';
import test from 'node:test';
import { installChecker, repository } from './test-repository.mjs';
import { BAD, CLEAN, TOKEN, ZERO, fixture, remote } from './round8-hook-fixture.mjs';

const MODES = ['--staged', '--all', '--range', '--push'];

function prepare(t, layout) {
  const outer = repository(t);
  outer.write('root.ts', CLEAN);
  outer.commit();
  let root = join(outer.root, 'apps/project');
  if (layout === 'gitlink') {
    const seed = repository(t);
    seed.write('root.ts', CLEAN);
    seed.commit();
    outer.git('-c', 'protocol.file.allow=always', 'submodule', 'add', seed.root, 'apps/project');
    outer.commit();
  } else if (layout === 'worktree') {
    root = join(outer.root, 'linked');
    outer.git('worktree', 'add', '-b', 'linked', root);
  } else {
    mkdirSync(root, { recursive: true });
    if (layout !== 'ordinary') {
      const args = ['init', '--initial-branch=feature'];
      if (layout === 'separate') args.push('--separate-git-dir', join(outer.root, 'git-data'));
      execFileSync('git', args, { cwd: root, env: outer.env, stdio: 'pipe' });
    }
  }
  const git = (...args) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', ...args], {
      cwd: root,
      env: outer.env,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  const entry = installChecker(root, { directory: 'scripts' });
  const target = layout === 'worktree' ? 'linked' : 'apps/project';
  const put = (path, content) => outer.write(join(target, path), content);
  put('backend/src/committed.ts', CLEAN);
  git('add', '.');
  git('commit', '-m', 'test: clean fixture');
  const base = git('rev-parse', 'HEAD');
  put('backend/src/committed.ts', CLEAN + BAD);
  git('add', '.');
  git('commit', '-m', 'test: committed fixture');
  const head = git('rev-parse', 'HEAD');
  put('backend/src/staged.ts', BAD);
  git('add', '.');
  return { outer, root, entry, base, head };
}

function scan(context, cwd, mode, environment = context.outer.env) {
  const args = mode === '--range' ? [mode, context.base, context.head] : [mode];
  if (mode === '--push') args.push('--hook', 'missing', 'missing');
  return spawnSync(process.execPath, [context.entry, ...args], {
    cwd,
    env: environment,
    encoding: 'utf8',
    input:
      mode === '--push'
        ? `refs/heads/feature ${context.head} refs/heads/feature ${context.base}\n`
        : undefined,
  });
}

for (const layout of ['nested', 'gitlink']) {
  for (const mode of MODES) {
    test(`${layout} checker refuses a selected outer repository in ${mode}`, (t) => {
      const context = prepare(t, layout);
      const result = scan(context, context.outer.root, mode);
      assert.deepEqual(
        {
          status: result.status,
          lines: result.stderr.trim().split('\n').filter(Boolean).length,
          refused: result.stderr.includes('outside the selected Git repository'),
        },
        { status: 2, lines: 1, refused: true },
      );
    });
  }
}

for (const layout of ['nested', 'gitlink']) {
  for (const mode of MODES) {
    test(`${layout} discovery ignores selected outer repository overrides in ${mode}`, (t) => {
      const context = prepare(t, layout);
      const result = scan(context, context.root, mode, {
        ...context.outer.env,
        GIT_DIR: join(context.outer.root, '.git'),
        GIT_WORK_TREE: context.outer.root,
        GIT_INDEX_FILE: join(context.outer.root, '.git/index'),
      });
      assert.deepEqual(
        {
          status: result.status,
          lines: result.stderr.trim().split('\n').filter(Boolean).length,
          refused: result.stderr.includes('outside the selected Git repository'),
        },
        { status: 2, lines: 1, refused: true },
      );
    });
  }
}

for (const layout of ['nested', 'gitlink', 'ordinary', 'worktree', 'separate']) {
  for (const mode of MODES) {
    test(`${layout} checker scans inside its own repository in ${mode}`, (t) => {
      const context = prepare(t, layout);
      const result = scan(context, context.root, mode);
      const hits = [
        ...result.stderr.matchAll(/(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "([^"]+)"/g),
      ].map((match) => [match[1], Number(match[2]), match[3]]);
      const expected =
        mode === '--staged'
          ? [['backend/src/staged.ts', 1, TOKEN]]
          : mode === '--all'
            ? [
                ['backend/src/committed.ts', 2, TOKEN],
                ['backend/src/staged.ts', 1, TOKEN],
              ]
            : [['backend/src/committed.ts', 2, TOKEN]];
      assert.deepEqual({ status: result.status, hits }, { status: 1, hits: expected });
    });
  }
}

for (const mode of MODES) {
  test(`a marker-free detached worktree scans without a surrounding repository in ${mode}`, (t) => {
    const repo = repository(t);
    repo.write('backend/src/committed.ts', CLEAN);
    const base = repo.commit();
    repo.write('backend/src/committed.ts', CLEAN + BAD);
    const head = repo.commit();
    repo.write('backend/src/staged.ts', BAD);
    repo.git('add', '.');
    const container = repository(t, ['--bare']);
    const metadata = join(container.root, 'detached-git');
    renameSync(join(repo.root, '.git'), metadata);
    const cwd = join(repo.root, 'backend/src');
    const args = mode === '--range' ? [mode, base, head] : [mode];
    if (mode === '--push') args.push('--hook', 'missing', 'missing');
    const result = spawnSync(process.execPath, [repo.entry, ...args], {
      cwd,
      env: { ...repo.env, GIT_DIR: relative(cwd, metadata), GIT_WORK_TREE: '../..' },
      encoding: 'utf8',
      input:
        mode === '--push' ? `refs/heads/feature ${head} refs/heads/feature ${base}\n` : undefined,
    });
    const hits = [
      ...result.stderr.matchAll(/(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "([^"]+)"/g),
    ].map((match) => [match[1], Number(match[2]), match[3]]);
    const expected =
      mode === '--staged'
        ? [['backend/src/staged.ts', 1, TOKEN]]
        : mode === '--all'
          ? [
              ['backend/src/committed.ts', 2, TOKEN],
              ['backend/src/staged.ts', 1, TOKEN],
            ]
          : [['backend/src/committed.ts', 2, TOKEN]];
    assert.deepEqual({ status: result.status, hits }, { status: 1, hits: expected });
  });
}

test('a relative destination URL is resolved from the selected root when invoked in a subdirectory', (t) => {
  const repo = fixture(t);
  const primary = remote(t, repo, 'primary');
  const fork = remote(t, repo, 'fork');
  repo.git('push', 'primary', 'HEAD:seed');
  repo.git('push', 'fork', 'HEAD:seed');
  repo.write('backend/src/dirty.ts', BAD);
  const head = repo.commit();
  repo.git('push', 'fork', 'HEAD:side');
  const url = relative(repo.root, primary.root);
  symlinkSync(fork.root, join(repo.root, 'backend', basename(primary.root)), 'dir');
  const result = spawnSync(process.execPath, [repo.entry, '--push', '--hook', url, url], {
    cwd: join(repo.root, 'backend/src'),
    env: repo.env,
    encoding: 'utf8',
    input: `refs/heads/feature ${head} refs/heads/feature ${ZERO}\n`,
  });
  const hits = [
    ...result.stderr.matchAll(/(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "([^"]+)"/g),
  ].map((match) => [match[1], Number(match[2]), match[3]]);
  assert.deepEqual(
    { status: result.status, hits },
    {
      status: 1,
      hits: [['backend/src/dirty.ts', 1, TOKEN]],
    },
  );
});
