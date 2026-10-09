import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, rmSync, symlinkSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import test from 'node:test';
import { repository } from '../test-repository.mjs';

const TOKEN = 'inner' + 'HTML';
const CLEAN = 'export const value = 1;\n';
const BAD = `node.${TOKEN} = value;\n`;
const MODES = ['--staged', '--all', '--range', '--push'];

function caseAlias(t, path, name, kind = 'dir') {
  const alias = join(dirname(path), name);
  if (!existsSync(alias)) {
    symlinkSync(path, alias, kind);
    t.after(() => rmSync(alias, { force: true }));
  }
  return alias;
}

function run(repo, entry, args, env = repo.env) {
  const result = spawnSync(process.execPath, ['--preserve-symlinks-main', entry, ...args], {
    cwd: repo.root,
    env,
    encoding: 'utf8',
  });
  return {
    status: result.status,
    diagnostic: result.stderr,
    hits: [
      ...result.stderr.matchAll(
        /^(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm,
      ),
    ].map((match) => [match[1], Number(match[2]), JSON.parse(`"${match[3]}"`)]),
  };
}

for (const kind of ['project', 'directory', 'file']) {
  for (const mode of MODES) {
    test(`a native ${kind} case alias scans ${mode}`, (t) => {
      const repo = repository(t);
      repo.write('src/value.ts', CLEAN);
      const base = repo.commit();
      repo.write('src/value.ts', CLEAN + BAD);
      const head = repo.commit();
      let entry;
      if (kind === 'project') {
        const root = caseAlias(t, repo.root, basename(repo.root).toUpperCase());
        entry = join(root, '.guardrails-runner/check-hard-bans.mjs');
      } else if (kind === 'directory') {
        const directory = caseAlias(t, dirname(repo.entry), '.GUARDRAILS-RUNNER');
        entry = join(directory, 'check-hard-bans.mjs');
      } else {
        entry = caseAlias(t, repo.entry, 'CHECK-HARD-BANS.mjs', 'file');
      }
      if (mode === '--staged') {
        repo.git('reset', '--soft', base);
      }
      const args = mode === '--range' ? [mode, base, head] : [mode];
      const result = run(repo, entry, args);
      assert.deepEqual(
        { status: result.status, hits: result.hits },
        { status: 1, hits: [['src/value.ts', 2, TOKEN]] },
      );
    });
  }
}

test('a native file case alias dispatches unknown flags as a single usage error', (t) => {
  const repo = repository(t);
  const entry = caseAlias(t, repo.entry, 'CHECK-HARD-BANS.mjs', 'file');
  const result = run(repo, entry, ['--bogus']);
  assert.deepEqual(
    {
      status: result.status,
      hits: result.hits,
      lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
    },
    { status: 2, hits: [], lines: 1 },
  );
});

for (const mode of MODES) {
  test(`native Git-root canonicalization aligns a selected case alias for ${mode}`, (t) => {
    const repo = repository(t);
    repo.write('src/value.ts', CLEAN);
    const base = repo.commit();
    repo.write('src/value.ts', CLEAN + BAD);
    const head = repo.commit();
    if (mode === '--staged') repo.git('reset', '--soft', base);
    const root = caseAlias(t, repo.root, basename(repo.root).toUpperCase());
    const args = mode === '--range' ? [mode, base, head] : [mode];
    const result = run(repo, repo.entry, args, { ...repo.env, GIT_WORK_TREE: root });
    assert.deepEqual(
      { status: result.status, hits: result.hits },
      { status: 1, hits: [['src/value.ts', 2, TOKEN]] },
    );
  });
}

for (const mode of MODES) {
  test(`an outside checker refuses an empty selected repository in ${mode}`, (t) => {
    const installed = repository(t);
    const selected = repository(t);
    const head = selected.commit();
    const args = mode === '--range' ? [mode, head, head] : [mode];
    const result = run(selected, installed.entry, args);
    assert.deepEqual(
      {
        status: result.status,
        hits: result.hits,
        outside: /outside.*repository/.test(result.diagnostic),
        lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
      },
      { status: 2, hits: [], outside: true, lines: 1 },
    );
  });
}
