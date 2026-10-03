import { execFileSync, spawnSync } from 'node:child_process';
import {
  appendFileSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitEnvironment } from './git-environment.mjs';

export function installChecker(root, { directory: target = '.guardrails-runner' } = {}) {
  const directory = join(root, target, 'guardrails');
  mkdirSync(directory, { recursive: true });
  copyFileSync(
    fileURLToPath(new URL('../check-hard-bans.mjs', import.meta.url)),
    join(root, target, 'check-hard-bans.mjs'),
  );
  for (const file of readdirSync(fileURLToPath(new URL('.', import.meta.url)))) {
    if (
      file.endsWith('.mjs') &&
      !/\.(?:test|slow)\.mjs$/.test(file) &&
      !['test-repository.mjs', 'workspace-policy.mjs'].includes(file)
    )
      copyFileSync(fileURLToPath(new URL(file, import.meta.url)), join(directory, file));
  }
  return join(root, target, 'check-hard-bans.mjs');
}

export function repository(t, initArgs = []) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'guardrails-')));
  let entry;
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const env = gitEnvironment({
    PATH: process.env.PATH,
    HOME: root,
    XDG_CONFIG_HOME: root,
    GIT_CONFIG_NOSYSTEM: '1',
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_AUTHOR_NAME: 'Fixture',
    GIT_COMMITTER_NAME: 'Fixture',
    GIT_AUTHOR_EMAIL: 'fixture@example.test',
    GIT_COMMITTER_EMAIL: 'fixture@example.test',
    GIT_AUTHOR_DATE: '2000-01-01T00:00:00Z',
    GIT_COMMITTER_DATE: '2000-01-01T00:00:00Z',
  });
  const git = (...args) =>
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', ...args], {
      cwd: root,
      env,
      encoding: 'utf8',
      stdio: 'pipe',
    }).trim();
  const write = (filePath, content) => {
    mkdirSync(dirname(join(root, filePath)), { recursive: true });
    writeFileSync(join(root, filePath), content);
  };
  const commit = () => {
    git('add', '.');
    git('commit', '--quiet', '--allow-empty', '-m', 'test: fixture');
    return git('rev-parse', 'HEAD');
  };
  const runCheck = (cwd, args, input) => {
    const result = spawnSync(process.execPath, [entry, ...args], {
      cwd,
      env,
      encoding: 'utf8',
      input,
    });
    const hits = [
      ...result.stderr.matchAll(
        /^(?:\[[a-f0-9]+\] )?(.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm,
      ),
    ].map((match) => [match[1], Number(match[2]), JSON.parse(`"${match[3]}"`)]);
    const caps = [...result.stderr.matchAll(/^(?:\[[a-f0-9]+\] )?(.+?): (\d+) lines /gm)].map(
      (match) => [match[1], Number(match[2])],
    );
    return { status: result.status, hits, caps, diagnostic: result.stderr };
  };
  const checkAt = (cwd, ...args) => runCheck(cwd, args);
  const check = (...args) => checkAt(root, ...args);
  const checkInput = (input, ...args) => runCheck(root, args, input);
  git('init', '--initial-branch=feature', ...initArgs);
  entry = installChecker(root);
  appendFileSync(
    resolve(root, git('rev-parse', '--git-path', 'info/exclude')),
    '\n.guardrails-runner/\n',
  );
  return { root, git, write, commit, check, checkAt, checkInput, env, entry };
}

export function outcome(result) {
  return { status: result.status, hits: result.hits, caps: result.caps };
}
