import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { outcome, repository } from '../test-repository.mjs';

const CLEAN = 'export const value = 1;\n';

function api(repo, expression) {
  const module = pathToFileURL(join(repo.root, '.guardrails-runner/guardrails/git/refs.mjs')).href;
  const result = spawnSync(
    process.execPath,
    [
      '--input-type=module',
      '-e',
      `import { resolveCommit, resolvePushRange } from ${JSON.stringify(module)};\n` +
        `try { console.log(JSON.stringify(${expression})); } catch { console.log(JSON.stringify({ error: true })); }`,
    ],
    { cwd: repo.root, env: repo.env, encoding: 'utf8' },
  );
  if (result.status !== 0) throw new Error(result.stderr);
  return JSON.parse(result.stdout);
}

test('public commit resolution refuses a tree and peels an annotated commit tag', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  const tree = repo.git('rev-parse', 'HEAD^{tree}');
  repo.git('tag', '-a', '-m', 'fixture', 'commit-tag');
  assert.deepEqual(api(repo, `resolveCommit(${JSON.stringify(tree)}, 'base')`), { error: true });
  assert.equal(api(repo, "resolveCommit('commit-tag', 'base')"), head);
});

test('a real leading-dash ref is refused instead of used as a range base', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const head = repo.commit();
  repo.git('update-ref', '--', '-leading', head);
  const result = repo.check('--range', '-leading', 'HEAD');
  assert.deepEqual(
    { ...outcome(result), lines: result.diagnostic.trim().split('\n').filter(Boolean).length },
    { status: 2, hits: [], caps: [], lines: 1 },
  );
});

test('criss-cross merge bases retain all candidates and break equal distances deterministically', (t) => {
  const repo = repository(t);
  repo.write('src/root.ts', CLEAN);
  const root = repo.commit();
  const tree = repo.git('rev-parse', 'HEAD^{tree}');
  const a = repo.git('commit-tree', tree, '-p', root, '-m', 'fixture A0');
  const b = repo.git('commit-tree', tree, '-p', root, '-m', 'fixture B0');
  const left = repo.git('commit-tree', tree, '-p', a, '-p', b, '-m', 'fixture left');
  const right = repo.git('commit-tree', tree, '-p', b, '-p', a, '-m', 'fixture right');
  repo.git('update-ref', 'refs/heads/feature', left);
  repo.git('update-ref', 'refs/heads/main', right);
  const result = api(repo, 'resolvePushRange().base');
  assert.equal(result, '198bc73f9cf54ad36bf2fabd0eb752954f704388');
});
