import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const TEMPLATE_FIXTURE = vi.hoisted(() => ({ path: '' }));

vi.mock('node:fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs/promises')>();
  const { writeAnswersTemplate } = await import('./answers-fixture.js');
  const { templateDir } = await import('../src/paths.js');
  return {
    ...actual,
    lstat: async (path: Parameters<typeof actual.lstat>[0]) =>
      actual.lstat(path === templateDir() ? TEMPLATE_FIXTURE.path : path),
    cp: async (_source: string, target: string): Promise<void> => {
      writeAnswersTemplate(target);
      for (const path of [
        'README.md',
        'docs/README.md',
        'docs/setup/setup-smtp.md',
        '.husky/pre-commit',
        '.husky/commit-msg',
        '.husky/pre-push',
      ]) {
        mkdirSync(dirname(join(target, path)), { recursive: true });
        writeFileSync(join(target, path), path.endsWith('.md') ? '# Fixture\n' : '#!/bin/sh\n');
      }
    },
  };
});

import { loadManifest } from '../src/manifest/load.js';
import { resolvePlan } from '../src/manifest/plan.js';
import { parseCliOptions } from '../src/flags/options.js';
import { answersRecord, readAnswersRecord } from '../src/scaffold/answers.js';
import { scaffoldProject } from '../src/scaffold/project.js';
import { fixtureRoot, isolatedGit, TEMPLATE_SHA } from './answers-helpers.js';
import { writePnpmBoundary } from './pnpm-boundary.js';

const roots: string[] = [];

beforeEach(async () => {
  TEMPLATE_FIXTURE.path = fixtureRoot(roots);
  const bin = join(TEMPLATE_FIXTURE.path, 'bin');
  mkdirSync(bin);
  await writePnpmBoundary(bin, '', '12.6.0', true);
  const { overrides } = isolatedGit(TEMPLATE_FIXTURE.path);
  for (const [key, value] of Object.entries(overrides)) vi.stubEnv(key, value);
  vi.stubEnv('PATH', [bin, process.env.PATH ?? ''].join(delimiter));
  vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

it.each(['strict', 'standard'] as const)(
  'returns the completed %s scaffold as data with its recorded rules',
  async (rules) => {
    const target = join(TEMPLATE_FIXTURE.path, 'app');
    const manifest = await loadManifest(TEMPLATE_FIXTURE.path);
    const options = parseCliOptions([target, '--yes', '--no-git', '--no-install']);
    const plan = resolvePlan(manifest, {
      features: ['email-password'],
      rules,
      options: { docker: true },
    });
    const result = await scaffoldProject(
      target,
      manifest,
      plan,
      options,
      answersRecord(
        { name: 'create-nest-next-auth', version: '0.1.0' },
        { sha256: TEMPLATE_SHA },
        plan,
      ),
    );

    expect(result?.files).toEqual({ count: 22, instructions: ['AGENTS.md', 'CLAUDE.md'] });
    expect({ summary: result?.rules, recorded: (await readAnswersRecord(target)).rules }).toEqual({
      summary: rules,
      recorded: { policy: rules },
    });
    expect({
      lockfile: result?.lockfile,
      git: result?.git,
      install: result?.install,
      hooks: result?.hooks,
      exitCode: result?.exitCode,
      nextSteps: result?.nextSteps,
    }).toEqual({
      lockfile: { status: 'updated' },
      git: { status: 'not-requested' },
      install: { status: 'not-requested' },
      hooks: { included: true, active: false, activationCommand: 'git init && pnpm install' },
      exitCode: 0,
      nextSteps: [
        `cd ${target}`,
        'pnpm install',
        'cp .env.docker.example .env.docker',
        'docker compose --env-file .env.docker up -d',
      ],
    });
  },
);
