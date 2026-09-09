import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { MARKER_EXTENSIONS, SKIPPED_DIRS } from '../src/constants/index.js';

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

  if (!packed.ok) rmSync(workspace, { recursive: true, force: true });
  return packed;
}

const MARKER_COMMENT = /(\/\/|\{\/\*)\s*feature:[a-z0-9-]/;

/** Generated source files that still carry a marker comment. */
function sourceFilesWithMarkers(root: string, prefix = ''): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      found.push(...sourceFilesWithMarkers(root, relative));
      continue;
    }
    if (!(MARKER_EXTENSIONS as readonly string[]).includes(extname(entry.name))) continue;
    const content = readFileSync(join(root, relative), 'utf8');
    if (MARKER_COMMENT.test(content)) found.push(relative);
  }

  return found;
}

function scaffold(packed: Packed, name: string, features?: string): ReturnType<typeof spawnSync> {
  const target = join(packed.workspace, name);
  const args = [packed.cli, target, '--yes', '--no-install', '--no-git'];
  if (features !== undefined) args.push('--features', features);
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: BUILD_TIMEOUT });
}

let packed: Packed;

beforeAll(() => {
  packed = buildAndPack();
  expect(packed.ok, packed.reason ?? 'the package did not build').toBe(true);
});

afterAll(() => {
  if (packed) rmSync(packed.workspace, { recursive: true, force: true });
});

describe('the packed CLI', () => {
  it('excludes runtime artifacts and prohibited names before copying template files', () => {
    const fixture = mkdtempSync(join(tmpdir(), 'cna-template-exclusions-'));
    const script = join(fixture, 'packages/create-nest-next-auth/scripts/sync-template.mjs');
    const artifacts = [
      'output/playwright/sentinel.txt',
      'backend/test-results/sentinel.txt',
      'frontend/playwright-report/sentinel.txt',
      'blob-report/sentinel.txt',
      'frontend/.auth/sentinel.json',
      '.mongodb-binaries/sentinel.txt',
      'mongodb-memory-server/sentinel.txt',
      '.env.synthetic',
      'backend/.env.extra.example',
    ];
    const kept = [
      'README.md',
      'frontend/e2e/fixtures/source.ts',
      '.env.docker.example',
      'backend/.env.example',
      'frontend/.env.example',
    ];
    try {
      mkdirSync(dirname(script), { recursive: true });
      copyFileSync(join(PACKAGE_DIR, 'scripts/sync-template.mjs'), script);
      for (const path of [...artifacts, ...kept]) {
        mkdirSync(dirname(join(fixture, path)), { recursive: true });
        writeFileSync(join(fixture, path), 'synthetic sentinel\n');
      }
      writeFileSync(join(fixture, 'template.manifest.json'), '{"features":{}}');
      execFileSync(process.execPath, [script], { timeout: 10_000, stdio: 'pipe' });
      const template = join(fixture, 'packages/create-nest-next-auth/template');
      for (const path of artifacts) expect(existsSync(join(template, path)), path).toBe(false);
      for (const path of kept) expect(existsSync(join(template, path)), path).toBe(true);

      // Certificate and credential names are strings only; no such file is created or opened.
      const prohibited = [
        'fixture.pem',
        'fixture.key',
        'fixture.crt',
        '.ssh',
        '.aws',
        '.kube',
        'ssl',
        '.config/gcloud',
      ];
      const output = execFileSync(
        process.execPath,
        [
          '--input-type=module',
          '--eval',
          `
        import { pathToFileURL } from 'node:url';
        const { isExcluded } = await import(pathToFileURL(process.argv[2]).href);
        const paths = JSON.parse(process.argv[3]);
        console.log(JSON.stringify(paths.map(path => isExcluded(path, path.split('/').pop(), !/[.](pem|key|crt)$/.test(path)))));
      `,
          process.execPath,
          script,
          JSON.stringify(prohibited),
        ],
        { encoding: 'utf8', timeout: 10_000 },
      );
      expect(JSON.parse(output)).toEqual(prohibited.map(() => true));
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('keeps every default provider and takes the markers off', () => {
    const result = scaffold(packed, 'full');
    const project = join(packed.workspace, 'full');

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    for (const provider of ['google', 'github', 'facebook']) {
      const strategy = `backend/src/auth/oauth/strategies/${provider}-oauth.strategy.ts`;
      expect(existsSync(join(project, strategy)), strategy).toBe(true);
    }

    const appModule = readFileSync(join(project, 'backend/src/app.module.ts'), 'utf8');
    expect(appModule).toContain('GoogleOAuthStrategy');
    expect(appModule).not.toContain('feature:');
  });

  it('restores the file names npm strips from a tarball', () => {
    const project = join(packed.workspace, 'full');
    expect(existsSync(join(project, '.gitignore'))).toBe(true);
    expect(existsSync(join(project, 'package-lock.json'))).toBe(true);
    expect(existsSync(join(project, '_gitignore'))).toBe(false);
  });

  it.each(['email-password', 'email-password,google'])(
    'keeps usable API and unit tests without the maintainer browser harness for %s',
    (features) => {
      const name = `test-scope-${features.replaceAll(',', '-')}`;
      const result = scaffold(packed, name, features);
      expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
      const project = join(packed.workspace, name);
      for (const path of [
        'frontend/e2e',
        'frontend/playwright.config.ts',
        'frontend/playwright.frontend.config.ts',
        'backend/test/utils/browser-server.ts',
        'backend/test/utils/local-oauth.ts',
      ])
        expect(existsSync(join(project, path)), path).toBe(false);
      for (const path of [
        'backend/test/utils/e2e-app.ts',
        'backend/test/jest-e2e.json',
        'backend/test/app.e2e-spec.ts',
        'frontend/vitest.config.ts',
        'frontend/src/modules/users/api/usersApi.test.ts',
      ])
        expect(existsSync(join(project, path)), path).toBe(true);
      const frontend = JSON.parse(readFileSync(join(project, 'frontend/package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      expect(frontend.scripts.test).toBe('vitest run');
      expect(Object.keys(frontend.scripts).filter((name) => name.startsWith('test:e2e'))).toEqual(
        [],
      );
      const backend = JSON.parse(readFileSync(join(project, 'backend/package.json'), 'utf8')) as {
        scripts: Record<string, string>;
      };
      expect(backend.scripts['test:e2e']).toContain('test/jest-e2e.json');
      expect(readFileSync(join(project, 'frontend/README.md'), 'utf8')).toContain(
        'original source repository only',
      );
      if (!features.includes('google'))
        expect(readFileSync(join(project, 'backend/test/utils/e2e-app.ts'), 'utf8')).not.toContain(
          '../../src/auth/oauth/',
        );
    },
  );

  it.each(['full', 'test-scope-email-password'])(
    'keeps root README relative links usable for %s',
    (name) => {
      const project = join(packed.workspace, name);
      const readme = readFileSync(join(project, 'README.md'), 'utf8');
      for (const match of readme.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = match[1].split('#')[0];
        if (!target || /^[a-z]+:/i.test(target)) continue;
        expect(existsSync(join(project, target)), target).toBe(true);
      }
    },
  );

  it('prints the Compose environment-file command exactly', () => {
    const result = scaffold(packed, 'next-steps', 'email-password');
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(String(result.stdout)).toContain('docker compose --env-file .env.docker up -d');
    expect(String(result.stdout)).not.toContain('docker compose up -d');
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
      join(project, `backend/src/auth/oauth/strategies/${provider}-oauth.strategy.ts`);

    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    expect(existsSync(strategy('google'))).toBe(true);
    expect(existsSync(strategy('github'))).toBe(false);
    expect(existsSync(strategy('facebook'))).toBe(false);
    expect(existsSync(join(project, 'docs/setup-github-oauth.md'))).toBe(false);
    expect(existsSync(join(project, 'docs/setup-google-oauth.md'))).toBe(true);

    const providerFixture = readFileSync(
      join(project, 'backend/test/constants/oauth-boot-env.ts'),
      'utf8',
    );
    const ids = providerFixture.split('export const OAUTH_BOOT_PROVIDER_IDS = [')[1].split('];')[0];
    expect([...ids.matchAll(/'([^']+)'/g)].map((match) => match[1])).toEqual(['google']);

    const env = readFileSync(join(project, 'backend/.env.example'), 'utf8');
    expect(env).toContain('AUTH_FEATURES=oauth-core,email-password,google');
    expect(env).toContain('OAUTH_GOOGLE_CLIENT_ID');
    expect(env).not.toContain('OAUTH_GITHUB_CLIENT_ID');

    // Shared modules keep only the lines marked for what was selected.
    const appModule = readFileSync(join(project, 'backend/src/app.module.ts'), 'utf8');
    expect(appModule).toContain('GoogleOAuthStrategy');
    expect(appModule).not.toContain('GitHubOAuthStrategy');
    expect(appModule).not.toContain('TwoFactorModule');
  });

  it('keeps OAUTH_STATE_SECRET for passkeys-only without a synthetic injection', () => {
    const result = scaffold(packed, 'passkeys-only', 'passkeys');
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);
    const project = join(packed.workspace, 'passkeys-only');
    const env = readFileSync(join(project, 'backend/.env.example'), 'utf8');
    expect(env).toContain('OAUTH_STATE_SECRET');
    expect(env).toContain('AUTH_FEATURES=passkeys');
    const schema = readFileSync(join(project, 'backend/src/config/env.oauth.schema.ts'), 'utf8');
    expect(schema).toContain('@MinLength');
    expect(schema).not.toContain('feature:');
  });

  it('leaves no feature marker anywhere in the tree', () => {
    const project = join(packed.workspace, 'pruned');
    const marked = sourceFilesWithMarkers(project);

    expect(marked).toEqual([]);
  });
});
