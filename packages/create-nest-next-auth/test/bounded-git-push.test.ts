import { execFileSync } from 'node:child_process';
import {
  chmodSync,
  closeSync,
  constants,
  existsSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { GIT_PUSH_KILL_SIGNAL } from '../src/constants/index.js';
import { git, isolatedGit } from './answers-helpers.js';
import { boundedGitPush } from './bounded-git-push.js';

const FIXTURE_TIMEOUT_MS = 1000;
const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function pushFixture(): { root: string; env: NodeJS.ProcessEnv } {
  const root = mkdtempSync(join(tmpdir(), 'cna-push-bound-'));
  roots.push(root);
  const { env } = isolatedGit(root);
  git(['init', '--initial-branch=main'], root, env);
  git(['config', 'user.name', 'Fixture'], root, env);
  git(['config', 'user.email', 'fixture@example.test'], root, env);
  git(['commit', '--allow-empty', '-m', 'test: fixture'], root, env);
  git(['init', '--bare', '--initial-branch=main', join(root, 'destination.git')], root, env);
  git(['remote', 'add', 'origin', join(root, 'destination.git')], root, env);
  return { root, env };
}

it('reports a real blocked push as a timeout', () => {
  const { root, env } = pushFixture();
  execFileSync('mkfifo', [join(root, '.git/blocked')], { cwd: root, env });
  const hook = join(root, '.git/hooks/pre-push');
  writeFileSync(hook, '#!/bin/sh\necho $$ > .git/hook-pid\nread value < .git/blocked\n');
  chmodSync(hook, 0o755);
  try {
    expect(() => boundedGitPush(['origin', 'main'], root, env, FIXTURE_TIMEOUT_MS)).toThrow(
      'Git push fixture timed out after 1000 ms.',
    );
  } finally {
    releaseHook(root);
  }
});

it('preserves a real rejected push status', () => {
  const { root, env } = pushFixture();
  const hook = join(root, '.git/hooks/pre-push');
  writeFileSync(hook, '#!/bin/sh\nexit 1\n');
  chmodSync(hook, 0o755);
  expect(boundedGitPush(['origin', 'main'], root, env).status).toBe(1);
});

it('propagates failure to start Git', () => {
  const { root, env } = pushFixture();
  let failure: unknown;
  try {
    boundedGitPush(['origin', 'main'], root, { ...env, PATH: '' });
  } catch (error) {
    failure = error;
  }
  expect(failure).toMatchObject({ code: 'ENOENT' });
});

function releaseHook(root: string): void {
  const marker = join(root, '.git/hook-pid');
  if (existsSync(marker)) {
    try {
      const pid = Number(readFileSync(marker, 'utf8').trim());
      if (Number.isSafeInteger(pid) && pid > 0) process.kill(pid, GIT_PUSH_KILL_SIGNAL);
    } catch (error) {
      if (
        !(error instanceof Error) ||
        !('code' in error) ||
        !['ESRCH', 'EPERM'].includes(String(error.code))
      )
        throw error;
    }
  }
  let fd;
  try {
    fd = openSync(join(root, '.git/blocked'), constants.O_WRONLY | constants.O_NONBLOCK);
    writeSync(fd, 'release\n');
  } catch (error) {
    if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENXIO') throw error;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
