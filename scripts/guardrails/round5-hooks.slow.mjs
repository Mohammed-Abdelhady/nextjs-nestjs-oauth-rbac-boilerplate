import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { installChecker, repository } from './test-repository.mjs';
import { installHookTools } from './workspace-tool-fixture.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';

function fixture(t, hook = 'pre-push') {
  const repo = repository(t);
  installChecker(repo.root, { directory: 'scripts' });
  repo.write(
    'package.json',
    JSON.stringify({
      type: 'module',
      scripts: {
        lint: 'node scripts/lifecycle.mjs lint',
        typecheck: 'node scripts/lifecycle.mjs typecheck',
        test: 'node scripts/lifecycle.mjs test',
      },
    }),
  );
  repo.write(
    'scripts/lifecycle.mjs',
    "import { appendFileSync } from 'node:fs';\n" +
      "appendFileSync('.git/lifecycle', `${process.argv[2]}\\n`);\n",
  );
  repo.write(`.hooks/${hook}`, readFileSync(join(ROOT, '.husky', hook), 'utf8'));
  chmodSync(join(repo.root, '.hooks', hook), 0o755);
  repo.git('config', 'core.hooksPath', '.hooks');
  repo.write('src/root.ts', CLEAN);
  repo.commit();
  return repo;
}

function push(repo, ...args) {
  return spawnSync('git', ['-c', 'commit.gpgsign=false', 'push', ...args], {
    cwd: repo.root,
    env: { ...repo.env, npm_config_offline: 'true', npm_config_update_notifier: 'false' },
    encoding: 'utf8',
  });
}

function gates(repo) {
  const path = join(repo.root, '.git/lifecycle');
  return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n') : [];
}

test('an up-to-date real push has empty hook stdin even when checked-out HEAD is dirty', (t) => {
  const repo = fixture(t);
  const remote = repository(t, ['--bare']);
  repo.git('remote', 'add', 'origin', remote.root);
  repo.git('push', 'origin', 'feature');
  repo.git('switch', '-c', 'dirty');
  repo.write('src/mine.ts', BAD);
  repo.commit();
  const result = push(repo, 'origin', 'feature');
  assert.deepEqual(
    {
      status: result.status,
      gates: gates(repo),
      refs: remote.git('for-each-ref', '--format=%(refname)'),
      received: remote.git('rev-list', '--count', 'feature'),
    },
    {
      status: 0,
      gates: ['lint', 'typecheck', 'test'],
      refs: 'refs/heads/feature',
      received: '1',
    },
  );
});

test('an unknown remote tip reaches Git fetch guidance but a dirty force push is refused', (t) => {
  const repo = fixture(t);
  const remote = repository(t, ['--bare']);
  repo.git('remote', 'add', 'origin', remote.root);
  repo.git('push', 'origin', 'feature');
  const other = repository(t);
  other.git('fetch', remote.root, 'feature');
  other.git('reset', '--hard', 'FETCH_HEAD');
  other.write('src/theirs.ts', CLEAN);
  other.commit();
  other.git('push', remote.root, 'HEAD:feature');
  repo.write('src/own.ts', CLEAN);
  repo.commit();
  const clean = push(repo, 'origin', 'feature');
  assert.deepEqual(
    {
      status: clean.status,
      fetchHint: /fetch first/.test(clean.stderr),
      scannerError: /Guardrails could not run/.test(clean.stderr),
    },
    { status: 1, fetchHint: true, scannerError: false },
  );
  repo.write('src/own.ts', BAD);
  repo.commit();
  const dirty = push(repo, '--force', 'origin', 'feature');
  assert.deepEqual(
    {
      status: dirty.status,
      gates: gates(repo),
      refused: dirty.stderr.includes(`src/own.ts:1: banned token "${TOKEN}"`),
      received: remote.git('rev-list', '--count', 'feature'),
    },
    { status: 1, gates: ['lint', 'typecheck', 'test'], refused: true, received: '2' },
  );
});

test('a real commit-msg hook strips attribution and commits the valid author subject', (t) => {
  const repo = fixture(t, 'commit-msg');
  installHookTools(repo.root);
  repo.write('.gitignore', 'node_modules\n');
  repo.write('commitlint.config.cjs', readFileSync(join(ROOT, 'commitlint.config.cjs'), 'utf8'));
  const footer = ['Co-authored', 'by'].join('-') + ': ' + ['Cur', 'sor'].join('');
  repo.write('src/new.ts', CLEAN);
  repo.git('add', '.');
  const result = spawnSync(
    'git',
    ['-c', 'commit.gpgsign=false', 'commit', '-m', `test: author message\n\n${footer}\n`],
    {
      cwd: repo.root,
      env: { ...repo.env, npm_config_offline: 'true' },
      encoding: 'utf8',
    },
  );
  assert.deepEqual(
    { status: result.status, message: repo.git('log', '-1', '--format=%B') },
    { status: 0, message: 'test: author message' },
  );
});

test('multiline attribution that cannot be stripped fails the whole-message postcondition', (t) => {
  const repo = repository(t);
  const header = ['Co-authored', 'by'].join('-') + ':';
  const tool = ['Cur', 'sor'].join('');
  repo.write('message.txt', `test: author message\n\n${header}\n${tool}\n`);
  const result = repo.check('--commit-msg', join(repo.root, 'message.txt'));
  assert.deepEqual(
    {
      status: result.status,
      lines: result.diagnostic.trim().split('\n').filter(Boolean).length,
      message: readFileSync(join(repo.root, 'message.txt'), 'utf8'),
    },
    { status: 2, lines: 1, message: `test: author message\n\n${header}\n${tool}\n` },
  );
});

test('a thousand real tags pass every stdin record to the pre-push checker', (t) => {
  const repo = fixture(t);
  const remote = repository(t, ['--bare']);
  repo.git('remote', 'add', 'origin', remote.root);
  const root = repo.git('rev-parse', 'HEAD');
  repo.git('push', 'origin', 'feature');
  const refs = Array.from(
    { length: 999 },
    (_, index) =>
      `create refs/tags/clean-${String(index).padStart(4, '0')}-padding-padding-padding-padding ${root}\n`,
  ).join('');
  execFileSync('git', ['update-ref', '--stdin'], {
    cwd: repo.root,
    env: repo.env,
    input: refs,
    stdio: 'pipe',
  });
  repo.write('src/last.ts', BAD);
  repo.commit();
  repo.git('tag', 'zz-dirty-last');
  const result = push(repo, '--tags', 'origin');
  assert.deepEqual(
    {
      status: result.status,
      gates: gates(repo),
      remoteTags: remote.git('for-each-ref', '--format=%(refname)', 'refs/tags'),
      refused: result.stderr.includes(`src/last.ts:1: banned token "${TOKEN}"`),
    },
    { status: 1, gates: [], remoteTags: '', refused: true },
  );
});
