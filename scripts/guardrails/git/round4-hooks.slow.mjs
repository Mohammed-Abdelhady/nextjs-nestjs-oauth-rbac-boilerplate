import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { gitEnvironment } from './git-environment.mjs';
import { installChecker, repository } from '../test-repository.mjs';
import { installHookTools } from '../workspace/workspace-tool-fixture.mjs';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));
const TOKEN = 'inner' + 'HTML';
const BAD = `node.${TOKEN} = value;\n`;
const CLEAN = 'export const value = 1;\n';
const FORMATTED_CAST = 'export const value = input as ' + 'unknown as string;\n';
const CAST_TOKEN = 'as ' + 'unknown as';

function fixture(t, hookName) {
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
  repo.write('src/a.ts', CLEAN);
  repo.write(`.hooks/${hookName}`, readFileSync(join(REPO_ROOT, '.husky', hookName), 'utf8'));
  chmodSync(join(repo.root, '.hooks', hookName), 0o755);
  repo.git('config', 'core.hooksPath', '.hooks');
  repo.commit();
  return repo;
}

function invoke(repo, ...args) {
  return spawnSync('git', ['-c', 'commit.gpgsign=false', ...args], {
    cwd: repo.root,
    env: gitEnvironment({
      ...repo.env,
      npm_config_offline: 'true',
      npm_config_update_notifier: 'false',
    }),
    encoding: 'utf8',
  });
}

function bareRemote(t, repo, name = 'origin') {
  const remote = repository(t, ['--bare']);
  repo.git('remote', 'add', name, remote.root);
  return remote;
}

function lifecycle(repo) {
  const path = join(repo.root, '.git/lifecycle');
  return existsSync(path) ? readFileSync(path, 'utf8').trim().split('\n') : [];
}

test('real pre-push runs every gate in order for a clean first push', (t) => {
  const repo = fixture(t, 'pre-push');
  const remote = bareRemote(t, repo);
  const result = invoke(repo, 'push', 'origin', 'feature');
  assert.deepEqual(
    {
      status: result.status,
      gates: lifecycle(repo),
      received: remote.git('rev-list', '--count', 'feature'),
    },
    { status: 0, gates: ['lint', 'typecheck', 'test'], received: '1' },
  );
});

test('real pre-push checks a dirty other ref from clean HEAD before gates or remote writes', (t) => {
  const repo = fixture(t, 'pre-push');
  const remote = bareRemote(t, repo);
  repo.git('push', 'origin', 'feature');
  repo.git('switch', '-c', 'other');
  repo.write('src/other.ts', BAD);
  repo.commit();
  repo.git('switch', 'feature');
  const result = invoke(repo, 'push', 'origin', 'other');
  assert.deepEqual(
    {
      status: result.status,
      gates: lifecycle(repo),
      remoteRefs: remote.git('for-each-ref', '--format=%(refname)'),
      refusedToken: result.stderr.includes(`src/other.ts:1: banned token "${TOKEN}"`),
    },
    { status: 1, gates: [], remoteRefs: 'refs/heads/feature', refusedToken: true },
  );
});

test('real pre-push accepts inherited destination history proved by another updated ref', (t) => {
  const repo = fixture(t, 'pre-push');
  const remote = bareRemote(t, repo, 'destination');
  repo.write('src/legacy.ts', BAD);
  repo.commit();
  repo.git('push', 'destination', 'feature');
  repo.git('switch', '-c', 'new-clean');
  repo.write('src/new.ts', CLEAN);
  repo.commit();
  repo.git('switch', 'feature');
  repo.write('src/advance.ts', CLEAN);
  repo.commit();
  const result = invoke(repo, 'push', 'destination', 'feature', 'new-clean');
  assert.deepEqual(
    {
      status: result.status,
      gates: lifecycle(repo),
      remoteRefs: remote.git('for-each-ref', '--format=%(refname)'),
    },
    {
      status: 0,
      gates: ['lint', 'typecheck', 'test'],
      remoteRefs: 'refs/heads/feature\nrefs/heads/new-clean',
    },
  );
});

test('real pre-push trusts destination tracking history after its server ref is pruned', (t) => {
  const repo = fixture(t, 'pre-push');
  const remote = bareRemote(t, repo);
  repo.git('push', 'origin', 'feature');
  repo.write('src/stale.ts', BAD);
  repo.commit();
  repo.git('push', 'origin', 'HEAD:refs/heads/decoy');
  remote.git('update-ref', '-d', 'refs/heads/decoy');
  const result = invoke(repo, 'push', 'origin', 'feature');
  assert.deepEqual(
    {
      status: result.status,
      gates: lifecycle(repo),
      received: remote.git('rev-list', '--count', 'feature'),
      refusedToken: result.stderr.includes(`src/stale.ts:1: banned token "${TOKEN}"`),
    },
    { status: 0, gates: ['lint', 'typecheck', 'test'], received: '2', refusedToken: false },
  );
});

test('real pre-commit checks the final index after lint-staged and Prettier rewrite', (t) => {
  const repo = fixture(t, 'pre-commit');
  installHookTools(repo.root);
  repo.write('.gitignore', 'node_modules\n');
  repo.write('.lintstagedrc.json', JSON.stringify({ '*.ts': ['prettier --write'] }));
  repo.commit();
  repo.write('src/value.ts', 'export const value = ((input as unknown)) as string;\n');
  repo.git('add', 'src/value.ts');
  assert.equal(repo.check('--staged').status, 0);
  const before = repo.git('rev-parse', 'HEAD');
  const result = invoke(repo, 'commit', '-m', 'test: formatted input');
  assert.deepEqual(
    {
      status: result.status,
      committed: repo.git('rev-parse', 'HEAD') !== before,
      staged: repo.git('show', ':./src/value.ts'),
      working: readFileSync(join(repo.root, 'src/value.ts'), 'utf8'),
      refusedToken: result.stderr.includes(`src/value.ts:1: banned token "${CAST_TOKEN}"`),
    },
    {
      status: 1,
      committed: false,
      staged: FORMATTED_CAST.trimEnd(),
      working: FORMATTED_CAST,
      refusedToken: true,
    },
  );
});
