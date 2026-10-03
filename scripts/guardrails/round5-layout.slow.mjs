import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import { installChecker, repository } from './test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

function check(repo, entry, args, options = {}) {
  const result = spawnSync(process.execPath, [entry, ...args], {
    cwd: repo.root,
    env: repo.env,
    encoding: 'utf8',
    ...options,
  });
  return {
    status: result.status,
    hits: [
      ...result.stderr.matchAll(
        /^(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm,
      ),
    ].map((match) => [match[1], Number(match[2]), JSON.parse(`"${match[3]}"`)]),
    caps: [...result.stderr.matchAll(/^(?:\[[a-f0-9]+\] )?(.+?): (\d+) lines /gm)].map((match) => [
      match[1],
      Number(match[2]),
    ]),
  };
}

for (const mode of ['--staged', '--range', '--push', '--all']) {
  test(`installed nested entry invoked from outer root keeps local paths in ${mode}`, (t) => {
    const repo = repository(t);
    const project = join(repo.root, 'apps/proj');
    const entry = installChecker(project);
    repo.write('apps/proj/package.json', JSON.stringify({ workspaces: ['backend'] }));
    repo.write('apps/proj/backend/src/a.ts', CLEAN);
    const base = repo.commit();
    repo.write('apps/proj/backend/src/a.ts', BAD + CLEAN.repeat(350));
    repo.write('apps/proj-extra/backend/src/elsewhere.ts', BAD);
    repo.write('backend/src/elsewhere.ts', BAD);
    repo.git('add', '.');
    let args = [mode];
    let input;
    if (mode === '--range' || mode === '--push') {
      const head = repo.commit();
      args = mode === '--range' ? [mode, base, head] : [mode, '--hook', 'origin'];
      if (mode === '--push') input = `refs/heads/feature ${head} refs/heads/feature ${base}\n`;
    }
    assert.deepEqual(check(repo, entry, args, { input }), {
      status: 1,
      hits: [['backend/src/a.ts', 1, TOKEN]],
      caps: [['backend/src/a.ts', 351]],
    });
  });
}

for (const dirty of [false, true]) {
  test(`a nested real partial commit preserves Git's relative index, dirty=${dirty}`, (t) => {
    const repo = repository(t);
    const project = join(repo.root, 'apps/proj');
    const entry = installChecker(project);
    repo.write('apps/proj/backend/src/selected.ts', CLEAN);
    repo.write('apps/proj/backend/src/other.ts', CLEAN);
    repo.commit();
    repo.write(
      '.hooks/pre-commit',
      '#!/bin/sh\nset -e\ncd apps/proj\nexec "$GUARDRAILS_NODE" "$GUARDRAILS_ENTRY" --staged\n',
    );
    chmodSync(join(repo.root, '.hooks/pre-commit'), 0o755);
    repo.write('apps/proj/backend/src/other.ts', BAD);
    repo.git('add', 'apps/proj/backend/src/other.ts');
    repo.write('apps/proj/backend/src/selected.ts', dirty ? BAD : 'export const value = 2;\n');
    const result = spawnSync(
      'git',
      [
        '-c',
        `core.hooksPath=${join(repo.root, '.hooks')}`,
        '-c',
        'commit.gpgsign=false',
        'commit',
        '-m',
        'test: fixture',
        'apps/proj/backend/src/selected.ts',
      ],
      {
        cwd: repo.root,
        env: { ...repo.env, GUARDRAILS_NODE: process.execPath, GUARDRAILS_ENTRY: entry },
        encoding: 'utf8',
      },
    );
    assert.deepEqual(
      {
        status: result.status,
        selected: repo.git('show', 'HEAD:apps/proj/backend/src/selected.ts'),
        other: repo.git('show', ':./apps/proj/backend/src/other.ts'),
        refusal: result.stderr.includes(`backend/src/selected.ts:1: banned token "${TOKEN}"`),
      },
      dirty
        ? {
            status: 1,
            selected: 'export const value = 1;',
            other: `node.${TOKEN} = value;`,
            refusal: true,
          }
        : {
            status: 0,
            selected: 'export const value = 2;',
            other: `node.${TOKEN} = value;`,
            refusal: false,
          },
    );
  });
}

test('relative GIT_INDEX_FILE remains anchored to the repository after entering a nested project', (t) => {
  const repo = repository(t);
  const project = join(repo.root, 'apps/proj');
  const entry = installChecker(project);
  repo.write('apps/proj/backend/src/a.ts', CLEAN);
  repo.commit();
  repo.write('apps/proj/backend/src/a.ts', BAD);
  repo.git('add', '.');
  assert.deepEqual(
    check(repo, entry, ['--staged'], {
      cwd: project,
      env: { ...repo.env, GIT_INDEX_FILE: '.git/index' },
    }),
    { status: 1, hits: [['backend/src/a.ts', 1, TOKEN]], caps: [] },
  );
});

test('detached Git directory hook context wins over a surrounding repository', (t) => {
  const outer = repository(t);
  outer.write('src/outer.ts', CLEAN);
  outer.commit();
  const inner = join(outer.root, 'inner');
  mkdirSync(inner);
  outer.git('-C', inner, 'init', '--initial-branch=feature');
  const entry = installChecker(inner);
  outer.write('inner/src/a.ts', CLEAN);
  outer.git('-C', inner, 'add', 'src/a.ts');
  outer.git('-C', inner, 'commit', '-m', 'test: fixture');
  const gitdir = join(outer.root, 'detached.git');
  renameSync(join(inner, '.git'), gitdir);
  outer.write('inner/src/a.ts', BAD);
  outer.git(`--git-dir=${gitdir}`, `--work-tree=${inner}`, 'add', 'src/a.ts');
  outer.write('src/outer.ts', BAD);
  outer.git('add', 'src/outer.ts');
  assert.deepEqual(
    check(outer, entry, ['--staged'], {
      cwd: inner,
      env: {
        ...outer.env,
        GIT_DIR: gitdir,
        GIT_WORK_TREE: inner,
        GIT_INDEX_FILE: join(gitdir, 'index'),
      },
    }),
    { status: 1, hits: [['src/a.ts', 1, TOKEN]], caps: [] },
  );
});

test('scanner Git disables a configured filesystem monitor before it can run', (t) => {
  const repo = repository(t);
  repo.write('src/a.ts', CLEAN);
  repo.git('add', '.');
  repo.write(
    'monitor',
    '#!/bin/sh\nprintf called > "$GUARDRAILS_MONITOR"\nprintf "fixture-token\\0"\n',
  );
  chmodSync(join(repo.root, 'monitor'), 0o755);
  repo.git('config', 'core.fsmonitor', join(repo.root, 'monitor'));
  const marker = join(repo.root, 'monitor-called');
  const result = check(repo, repo.entry, ['--staged'], {
    env: { ...repo.env, GUARDRAILS_MONITOR: marker },
  });
  assert.deepEqual(
    { ...result, called: existsSync(marker) },
    { status: 0, hits: [], caps: [], called: false },
  );
});

test('relative detached repository variables retain meaning when scanner Git changes cwd', (t) => {
  const outer = repository(t);
  const project = join(outer.root, 'project');
  mkdirSync(project);
  outer.git('-C', project, 'init', '--initial-branch=feature');
  const entry = installChecker(project);
  outer.write('project/src/a.ts', CLEAN);
  outer.git('-C', project, 'add', 'src/a.ts');
  outer.git('-C', project, 'commit', '-m', 'test: fixture');
  const metadata = join(outer.root, 'metadata');
  renameSync(join(project, '.git'), metadata);
  outer.write('project/src/a.ts', BAD);
  outer.git(`--git-dir=${metadata}`, `--work-tree=${project}`, 'add', 'src/a.ts');
  const cwd = join(project, 'src/nested');
  mkdirSync(cwd);
  const env = { ...outer.env, GIT_DIR: '../../../metadata', GIT_WORK_TREE: '../..' };
  const direct = spawnSync('git', ['-c', 'core.fsmonitor=false', 'diff', '--cached'], {
    cwd,
    env,
    encoding: 'utf8',
  });
  if (direct.status !== 0 || !direct.stdout.includes(TOKEN))
    throw new Error('Detached fixture setup failed');
  assert.deepEqual(check(outer, entry, ['--staged'], { cwd, env }), {
    status: 1,
    hits: [['src/a.ts', 1, TOKEN]],
    caps: [],
  });
});

test('a pure rename from outside the project rechecks inherited content in its new scope', (t) => {
  const repo = repository(t);
  const entry = installChecker(join(repo.root, 'apps/proj'));
  repo.write('src/a.ts', BAD + CLEAN.repeat(10));
  const base = repo.commit();
  mkdirSync(join(repo.root, 'apps/proj/src'), { recursive: true });
  repo.git('mv', 'src/a.ts', 'apps/proj/src/a.ts');
  const head = repo.commit();
  assert.deepEqual(check(repo, entry, ['--range', base, head]), {
    status: 1,
    hits: [['src/a.ts', 1, TOKEN]],
    caps: [],
  });
});
