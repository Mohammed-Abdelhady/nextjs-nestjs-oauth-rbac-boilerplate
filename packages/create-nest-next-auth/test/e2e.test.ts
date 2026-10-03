import { execFileSync, spawnSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  ANSWERS_FILE_NAME,
  SHA256_HEX_PATTERN,
  TEMPLATE_IDENTITY_FILE,
} from '../src/constants/index.js';
import {
  BUILD_TIMEOUT,
  buildAndPack,
  type Packed,
  PACKAGE_DIR,
  scaffold,
  sourceFilesWithMarkers,
} from './packed-cli.js';
import { checkGeneratedHookHistory } from './generated-hook-history.js';
import { checkGeneratedGuardrails } from './generated-guardrails.js';
import {
  DEFAULT_SELECTION_MUST_EXIST,
  DEFAULT_SELECTION_MUST_NOT_EXIST,
} from './plain-run-fixture.js';

let packed: Packed;

beforeAll(() => {
  packed = buildAndPack();
  expect(packed.ok, packed.reason ?? 'the package did not build').toBe(true);
});

afterAll(() => {
  if (packed) rmSync(packed.workspace, { recursive: true, force: true });
});

describe('the packed CLI', () => {
  it('refuses a pre-hook local violation inherited by a clean generated branch', () => {
    checkGeneratedHookHistory(packed);
  });

  it('scans a default Git project cleanly', () => {
    checkGeneratedGuardrails(packed);
  });

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
      const constants = join(fixture, 'packages/create-nest-next-auth/src/constants');
      mkdirSync(constants, { recursive: true });
      copyFileSync(
        join(PACKAGE_DIR, 'src/constants/template-tests.json'),
        join(constants, 'template-tests.json'),
      );
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
    expect(readFileSync(join(project, '.gitignore'), 'utf8')).toContain('mongodb-data/');
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

  it('prints the version from its own package.json', () => {
    const result = spawnSync(process.execPath, [packed.cli, '--version'], {
      encoding: 'utf8',
      timeout: BUILD_TIMEOUT,
    });
    const packedPackage = JSON.parse(
      readFileSync(join(packed.workspace, 'package', 'package.json'), 'utf8'),
    ) as { version?: string };
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe(packedPackage.version);
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

  it('matches the default selection contract and rejects usage errors', () => {
    const result = scaffold(packed, 'plain-run');
    expect(result.status, `${result.stdout}\n${result.stderr}`).toBe(0);

    const project = join(packed.workspace, 'plain-run');
    for (const path of DEFAULT_SELECTION_MUST_EXIST) {
      expect(existsSync(join(project, path)), path).toBe(true);
    }
    for (const path of DEFAULT_SELECTION_MUST_NOT_EXIST) {
      expect(existsSync(join(project, path)), path).toBe(false);
    }
    // The packed answers file records the identity the packed build computed.
    const answers = JSON.parse(readFileSync(join(project, ANSWERS_FILE_NAME), 'utf8')) as {
      template?: { sha256?: unknown };
    };
    expect(String(answers.template?.sha256)).toMatch(SHA256_HEX_PATTERN);
    const packedIdentity = JSON.parse(
      readFileSync(join(packed.workspace, 'package', TEMPLATE_IDENTITY_FILE), 'utf8'),
    ) as { sha256?: unknown };
    expect(answers.template?.sha256).toBe(packedIdentity.sha256);
    const root = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')) as {
      name?: string;
    };
    expect(root.name).toBe('plain-run');
    expect(readFileSync(join(project, 'backend/.env.example'), 'utf8')).toContain(
      'AUTH_FEATURES=oauth-core,email-password,google,github,facebook',
    );
    expect(readFileSync(join(project, 'backend/src/app.module.ts'), 'utf8')).toContain(
      'GoogleOAuthStrategy',
    );
    expect(
      readFileSync(join(project, 'frontend/src/modules/users/api/usersApi.ts'), 'utf8'),
    ).toContain('usersApi');
    const run = (args: string[]): ReturnType<typeof spawnSync> =>
      spawnSync(process.execPath, [packed.cli, ...args], {
        encoding: 'utf8',
        timeout: BUILD_TIMEOUT,
      });
    const common = ['--yes', '--no-install', '--no-git'];
    expect(run([join(packed.workspace, 'bad-flag'), ...common, '--targets']).status).toBe(2);

    const target = join(packed.workspace, 'unknown-feature');
    const unknown = run([target, ...common, '--features', 'google,nope']);
    expect(unknown.status).toBe(2);
    expect(`${unknown.stdout}${unknown.stderr}`).toContain('nope');
    expect(existsSync(target)).toBe(false);
  });
});
