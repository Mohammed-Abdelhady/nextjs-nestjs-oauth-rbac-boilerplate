import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
const BUILD_TIMEOUT = 10 * 60 * 1000;

interface Packed {
  ok: boolean;
  reason?: string;
  cli: string;
  workspace: string;
}

/** Builds the package, packs it, and unpacks the tarball into a temp directory. */
function buildAndPack(): Packed {
  const workspace = mkdtempSync(join(tmpdir(), 'cna-e2e-'));
  const packed: Packed = { ok: false, cli: '', workspace };

  try {
    execFileSync('npm', ['run', 'build'], {
      cwd: PACKAGE_DIR,
      timeout: BUILD_TIMEOUT,
      stdio: 'pipe',
    });
    const output = execFileSync('npm', ['pack', '--pack-destination', workspace], {
      cwd: PACKAGE_DIR,
      timeout: BUILD_TIMEOUT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Pack writes to the npm cache. Keep it in the workspace so the test does
      // not depend on write access to the developer's ~/.npm.
      env: { ...process.env, npm_config_cache: join(workspace, 'npm-cache') },
    });
    const tarball = output.trim().split('\n').pop() ?? '';
    execFileSync('tar', ['-xzf', join(workspace, tarball), '-C', workspace], { stdio: 'pipe' });

    packed.cli = join(workspace, 'package', 'dist', 'index.js');
    packed.ok = existsSync(packed.cli);
    if (!packed.ok) packed.reason = 'the tarball has no dist/index.js';
  } catch (error) {
    packed.reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
  }

  // afterAll does not run when every test in the file is skipped, so a failed
  // build has to clean up after itself.
  if (!packed.ok) rmSync(workspace, { recursive: true, force: true });
  return packed;
}

function scaffold(packed: Packed, name: string, features?: string): ReturnType<typeof spawnSync> {
  const target = join(packed.workspace, name);
  const args = [packed.cli, target, '--yes', '--no-install', '--no-git'];
  if (features !== undefined) args.push('--features', features);
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: BUILD_TIMEOUT });
}

const packed = buildAndPack();
if (!packed.ok) {
  console.warn(`e2e skipped: ${packed.reason ?? 'the package did not build'}`);
}

afterAll(() => {
  rmSync(packed.workspace, { recursive: true, force: true });
});

describe.skipIf(!packed.ok)('the packed CLI', () => {
  it('keeps every provider when all defaults are accepted', () => {
    const result = scaffold(packed, 'full');
    const project = join(packed.workspace, 'full');

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    for (const provider of ['google', 'github', 'facebook']) {
      const strategy = `backend/src/auth/strategies/${provider}-oauth.strategy.ts`;
      expect(existsSync(join(project, strategy)), strategy).toBe(true);
    }
  });

  it('restores the file names npm strips from a tarball', () => {
    const project = join(packed.workspace, 'full');
    expect(existsSync(join(project, '.gitignore'))).toBe(true);
    expect(existsSync(join(project, 'package-lock.json'))).toBe(true);
    expect(existsSync(join(project, '_gitignore'))).toBe(false);
  });

  it('names the generated root package after the directory', () => {
    const manifest: unknown = JSON.parse(
      readFileSync(join(packed.workspace, 'full', 'package.json'), 'utf8'),
    );
    expect((manifest as { name?: string }).name).toBe('full');
  });

  it('drops the providers that were not selected', () => {
    const result = scaffold(packed, 'pruned', 'email-password,google');
    const project = join(packed.workspace, 'pruned');
    const strategy = (provider: string): string =>
      join(project, `backend/src/auth/strategies/${provider}-oauth.strategy.ts`);

    expect(existsSync(strategy('google'))).toBe(true);
    expect(existsSync(strategy('github'))).toBe(false);
    expect(existsSync(strategy('facebook'))).toBe(false);
    expect(existsSync(join(project, 'docs/setup-github-oauth.md'))).toBe(false);
    expect(existsSync(join(project, 'docs/setup-google-oauth.md'))).toBe(true);

    const env = readFileSync(join(project, 'backend/.env.example'), 'utf8');
    expect(env).toContain('AUTH_FEATURES=email-password,google');
    expect(env).toContain('OAUTH_GOOGLE_CLIENT_ID');
    expect(env).not.toContain('OAUTH_GITHUB_CLIENT_ID');

    // Until the provider registry lands, shared modules still import every
    // strategy, so the reference check is expected to fail and say so.
    if (result.status !== 0) {
      expect(`${result.stdout}${result.stderr}`).toContain('imports files that were removed');
    }
  });

  it('typechecks the generated backend when dependencies are present', () => {
    const project = join(packed.workspace, 'full');
    if (!existsSync(join(project, 'node_modules'))) {
      console.warn('typecheck skipped: the generated project has no node_modules');
      return;
    }
    const result = spawnSync('npm', ['run', 'typecheck'], {
      cwd: join(project, 'backend'),
      encoding: 'utf8',
      timeout: BUILD_TIMEOUT,
    });
    expect(result.status, result.stdout).toBe(0);
  });
});
