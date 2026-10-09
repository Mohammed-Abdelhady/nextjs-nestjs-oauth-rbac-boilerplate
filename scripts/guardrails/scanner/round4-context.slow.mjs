import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';
import { chmodSync, realpathSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gitEnvironment } from '../git/git-environment.mjs';
import { repository, outcome, installChecker } from '../test-repository.mjs';

const TOKEN = 'document.' + 'write';
const CLEAN = 'export const value = 1;\n';
const CHANGED = 'export const value = 2;\n';
const BANNED = `${TOKEN}('bad');\n`;

function project(t) {
  const repo = repository(t);
  repo.write('package.json', JSON.stringify({ workspaces: ['apps/*'] }));
  repo.write('apps/proj/package.json', JSON.stringify({ workspaces: ['backend'] }));
  repo.write('apps/proj/backend/package.json', JSON.stringify({ name: 'backend' }));
  installChecker(join(repo.root, 'apps/proj'));
  repo.write('apps/proj/backend/src/a.ts', CLEAN);
  repo.commit();
  return repo;
}

function paths(repo, cwd, files, installed = 'apps/proj') {
  const module = pathToFileURL(
    join(repo.root, installed, '.guardrails-runner/guardrails/workspace/project-paths.mjs'),
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { projectRoot, projectRelative } from ${JSON.stringify(module)};
    const root = process.argv[1];
    console.log(JSON.stringify({ root: projectRoot(root),
      paths: process.argv.slice(2).map((file) => projectRelative(file, root)) }));
  `,
      realpathSync(repo.root),
      ...files,
    ],
    { cwd, env: gitEnvironment(repo.env), encoding: 'utf8' },
  );
  assert.equal(result.status, 0);
  return JSON.parse(result.stdout);
}

function nestedCheck(repo, cwd, ...args) {
  const result = spawnSync(
    process.execPath,
    [join(repo.root, 'apps/proj/.guardrails-runner/check-hard-bans.mjs'), ...args],
    {
      cwd,
      env: repo.env,
      encoding: 'utf8',
    },
  );
  return {
    status: result.status,
    hits: [...result.stderr.matchAll(/^(.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm)].map(
      (match) => [match[1], Number(match[2]), JSON.parse(`"${match[3]}"`)],
    ),
    caps: [...result.stderr.matchAll(/^(.+?): (\d+) lines /gm)].map((match) => [
      match[1],
      Number(match[2]),
    ]),
  };
}

test('project context selects workspace root above a package-only backend and preserves literal paths', (t) => {
  const repo = project(t);
  assert.deepEqual(
    paths(repo, join(repo.root, 'apps/proj/backend'), [
      'apps/proj/backend/src/a.ts',
      'apps/proj/backend/src/x\\dist\\evil.ts',
      'other/src/a.ts',
      'apps/proj-extra/backend/src/a.ts',
    ]),
    {
      root: join(realpathSync(repo.root), 'apps/proj'),
      paths: ['backend/src/a.ts', 'backend/src/x\\dist\\evil.ts', null, null],
    },
  );
});

test('installed project context retains scope without workspaces', (t) => {
  const repo = repository(t);
  repo.write('apps/proj/package.json', JSON.stringify({ name: 'plain' }));
  installChecker(join(repo.root, 'apps/proj'));
  assert.deepEqual(paths(repo, repo.root, ['apps/proj/src/a.ts']), {
    root: join(realpathSync(repo.root), 'apps/proj'),
    paths: ['src/a.ts'],
  });
});

test('installed project context retains its root without a project marker', (t) => {
  const repo = repository(t);
  repo.write('backend/package.json', JSON.stringify({ name: 'backend' }));
  installChecker(join(repo.root, 'backend'));
  assert.deepEqual(paths(repo, repo.root, ['backend/src/a.ts'], 'backend'), {
    root: join(realpathSync(repo.root), 'backend'),
    paths: ['src/a.ts'],
  });
});

for (const directory of ['apps/proj', 'apps/proj/backend']) {
  test(`nested project ceiling applies from ${directory}`, (t) => {
    const repo = project(t);
    repo.write('apps/proj/backend/src/a.ts', 'export {};\n'.repeat(400));
    repo.git('add', '.');
    assert.deepEqual(outcome(nestedCheck(repo, join(repo.root, directory), '--staged')), {
      status: 1,
      hits: [],
      caps: [['backend/src/a.ts', 400]],
    });
  });
}

test('nested project exemptions are exact local paths and parent files are outside scope', (t) => {
  const repo = project(t);
  repo.write('apps/proj/scripts/guardrails/policy.mjs', `export const token = '${TOKEN}';\n`);
  repo.write('apps/proj/scripts/guardrails/scanner/check-hard-bans.test.mjs', `export const token = '${TOKEN}';\n`);
  repo.write('backend/src/outside.ts', BANNED);
  repo.write('apps/proj-extra/backend/src/outside.ts', BANNED);
  repo.write('backend/src/long.ts', 'export {};\n'.repeat(400));
  repo.git('add', '.');
  assert.deepEqual(outcome(nestedCheck(repo, join(repo.root, 'apps/proj'), '--staged')), {
    status: 0,
    hits: [],
    caps: [],
  });
});

test('a nested nonexempt checker-name look-alike is refused', (t) => {
  const repo = project(t);
  repo.write('apps/proj/backend/src/check-hard-bans.test.mjs', BANNED);
  repo.git('add', '.');
  assert.deepEqual(outcome(nestedCheck(repo, join(repo.root, 'apps/proj'), '--staged')), {
    status: 1,
    hits: [['backend/src/check-hard-bans.test.mjs', 1, TOKEN]],
    caps: [],
  });
});

function hook(repo) {
  repo.write(
    '.hooks/pre-commit',
    '#!/bin/sh\nexec "$GUARDRAILS_NODE" "$GUARDRAILS_ENTRY" --staged\n',
  );
  chmodSync(join(repo.root, '.hooks/pre-commit'), 0o755);
}

function hookCommit(repo, cwd, ...args) {
  const result = spawnSync(
    'git',
    [
      '-c',
      `core.hooksPath=${join(repo.root, '.hooks')}`,
      '-c',
      'commit.gpgsign=false',
      'commit',
      '--quiet',
      '-m',
      'test: hook',
      ...args,
    ],
    {
      cwd,
      env: {
        ...gitEnvironment(repo.env),
        GUARDRAILS_NODE: process.execPath,
        GUARDRAILS_ENTRY: installChecker(cwd),
      },
      encoding: 'utf8',
    },
  );
  const hits = [...result.stderr.matchAll(/^(.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm)].map(
    (match) => [match[1], Number(match[2]), JSON.parse(`"${match[3]}"`)],
  );
  return { status: result.status, hits };
}

function partial(t) {
  const repo = repository(t);
  repo.write('backend/src/selected.ts', CLEAN);
  repo.write('backend/src/unrelated.ts', CLEAN);
  repo.commit();
  hook(repo);
  return repo;
}

test('a real partial-commit hook checks its temporary index instead of unrelated normal staging', (t) => {
  const repo = partial(t);
  repo.write('backend/src/unrelated.ts', BANNED);
  repo.git('add', 'backend/src/unrelated.ts');
  repo.write('backend/src/selected.ts', CHANGED);
  const result = hookCommit(repo, repo.root, 'backend/src/selected.ts');
  assert.deepEqual(
    {
      result,
      committed: repo.git('show', 'HEAD:backend/src/selected.ts'),
      remaining: repo.git('show', ':backend/src/unrelated.ts'),
    },
    {
      result: { status: 0, hits: [] },
      committed: 'export const value = 2;',
      remaining: `${TOKEN}('bad');`,
    },
  );
});

test('a real partial-commit hook refuses a bad selected path despite a clean normal index', (t) => {
  const repo = partial(t);
  repo.write('backend/src/selected.ts', BANNED);
  const result = hookCommit(repo, repo.root, 'backend/src/selected.ts');
  assert.deepEqual(
    { result, committed: repo.git('show', 'HEAD:backend/src/selected.ts') },
    {
      result: { status: 1, hits: [['backend/src/selected.ts', 1, TOKEN]] },
      committed: 'export const value = 1;',
    },
  );
});

test('a real commit-a hook scans the final tracked index', (t) => {
  const repo = partial(t);
  repo.write('backend/src/selected.ts', BANNED);
  assert.deepEqual(hookCommit(repo, repo.root, '-a'), {
    status: 1,
    hits: [['backend/src/selected.ts', 1, TOKEN]],
  });
});

test('a real linked-worktree pre-commit hook scans the linked worktree', (t) => {
  const repo = partial(t);
  repo.git('worktree', 'add', '-b', 'linked', 'linked');
  repo.write('linked/backend/src/selected.ts', BANNED);
  const result = hookCommit(repo, join(repo.root, 'linked'), '-a');
  assert.deepEqual(
    { result, main: repo.git('show', 'HEAD:backend/src/selected.ts') },
    {
      result: { status: 1, hits: [['backend/src/selected.ts', 1, TOKEN]] },
      main: 'export const value = 1;',
    },
  );
});

test('malformed package metadata cannot prevent the package token check', (t) => {
  const repo = repository(t);
  repo.write('package.json', '{"token":"' + TOKEN + '"\n');
  repo.git('add', '.');
  assert.deepEqual(outcome(repo.check('--staged')), {
    status: 1,
    hits: [['package.json', 1, TOKEN]],
    caps: [],
  });
});

test('installed project context stays fixed after a changed working directory', (t) => {
  const repo = project(t);
  const module = pathToFileURL(
    join(repo.root, 'apps/proj/.guardrails-runner/guardrails/workspace/project-paths.mjs'),
  ).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `
    import { projectRoot } from ${JSON.stringify(module)};
    const root = process.argv[1];
    const first = projectRoot(root);
    process.chdir(root);
    console.log(JSON.stringify([first, projectRoot(root)]));
  `,
      realpathSync(repo.root),
    ],
    { cwd: join(repo.root, 'apps/proj/backend'), env: gitEnvironment(repo.env), encoding: 'utf8' },
  );
  assert.equal(result.status, 0);
  assert.deepEqual(JSON.parse(result.stdout), [
    join(realpathSync(repo.root), 'apps/proj'),
    join(realpathSync(repo.root), 'apps/proj'),
  ]);
});

test('a linked-worktree hook compares added lines with its own distinct HEAD', (t) => {
  const repo = partial(t);
  repo.git('worktree', 'add', '-b', 'linked', 'linked');
  const linked = join(repo.root, 'linked');
  repo.write('linked/backend/src/selected.ts', BANNED + CLEAN);
  repo.git('-C', linked, 'add', '.');
  repo.git('-C', linked, 'commit', '--quiet', '-m', 'test: inherited fixture');
  repo.write('linked/backend/src/selected.ts', BANNED + CHANGED);
  const result = hookCommit(repo, linked, '-a');
  assert.deepEqual(
    { result, main: repo.git('show', 'HEAD:backend/src/selected.ts') },
    {
      result: { status: 0, hits: [] },
      main: 'export const value = 1;',
    },
  );
});
