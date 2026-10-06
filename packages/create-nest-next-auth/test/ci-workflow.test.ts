import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isRecord } from '../src/manifest/read.js';
import {
  jobsOf,
  PNPM_SETUP_ACTION,
  PNPM_SETUP_WITH,
  readWorkflow,
  stepsOf,
} from './ci-workflow-helpers.js';

const WORKFLOW = new URL('../../../.github/workflows/ci.yml', import.meta.url);

describe('CI workflow contract', () => {
  it('uses fork-safe branch events with read-only permissions and ref concurrency', () => {
    const workflow = readWorkflow(WORKFLOW);
    expect(workflow.on).toEqual({
      pull_request: {
        branches: ['staging', 'master'],
        types: ['opened', 'synchronize', 'reopened'],
      },
      push: { branches: ['staging', 'master'] },
    });
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.concurrency).toEqual({
      group:
        "${{ github.workflow }}-${{ github.event_name }}-${{ github.ref }}-${{ github.event_name == 'push' && github.run_id || '' }}",
      'cancel-in-progress': "${{ github.event_name == 'pull_request' }}",
    });
  });

  it('keeps the range scan independent of installation and checks event head with full history', () => {
    const scan = jobsOf(readWorkflow(WORKFLOW))['range-scan'];
    expect(scan).toMatchObject({ if: 'github.event.deleted != true' });
    expect(isRecord(scan) && scan.needs).toBeUndefined();
    const steps = stepsOf(scan);
    expect(steps.map((step) => step.run).filter(Boolean)).toEqual(['node scripts/ci.mjs --range']);
    expect(steps[0].with).toEqual({
      'fetch-depth': 0,
      ref: '${{ github.event.pull_request.head.sha || github.sha }}',
      'persist-credentials': false,
    });
    expect(steps[1].with).toEqual({ 'node-version-file': '.nvmrc' });
  });

  it('pins actions and keeps package-manager commands in the shared entry point', () => {
    const jobs = jobsOf(readWorkflow(WORKFLOW));
    expect(Object.keys(jobs)).toEqual(['range-scan', 'quality', 'installer']);
    for (const job of Object.values(jobs)) {
      const steps = stepsOf(job);
      expect(steps[0].uses).toBe('actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683');
      expect(steps[1].uses).toBe('actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020');
      for (const step of steps) {
        if (step.uses === PNPM_SETUP_ACTION) expect(step.with).toEqual(PNPM_SETUP_WITH);
        if (typeof step.run !== 'string') continue;
        expect(step.run).toMatch(
          /^node scripts\/ci\.mjs --(range|cache|install|quality|installer)$/,
        );
      }
    }
    const rootPackage = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    ) as { packageManager: string };
    expect(rootPackage.packageManager).toBe('pnpm@12.6.0');
    expect(stepsOf(jobs.quality)[1].with).toEqual({
      'node-version-file': '.nvmrc',
      'package-manager-cache': false,
    });
    expect(stepsOf(jobs.quality)[2]).toMatchObject({
      uses: PNPM_SETUP_ACTION,
      with: PNPM_SETUP_WITH,
    });
    expect(stepsOf(jobs.installer)[2]).toMatchObject({
      uses: PNPM_SETUP_ACTION,
      with: PNPM_SETUP_WITH,
    });
    expect(
      stepsOf(jobs.quality)
        .filter((step) => step.run)
        .map((step) => step.run),
    ).toEqual([
      'node scripts/ci.mjs --cache',
      'node scripts/ci.mjs --install',
      'node scripts/ci.mjs --quality',
    ]);
    expect(
      stepsOf(jobs.installer)
        .filter((step) => step.run)
        .map((step) => step.run),
    ).toEqual([
      'node scripts/ci.mjs --cache',
      'node scripts/ci.mjs --install',
      'node scripts/ci.mjs --installer',
    ]);
    expect(jobs.installer).toMatchObject({ if: 'github.event.deleted != true' });
    expect(isRecord(jobs.installer) && jobs.installer.needs).toBeUndefined();
  });
});

const TRUSTED = new URL('../../../.github/workflows/trusted-scan.yml', import.meta.url);

it('uses only base code in the read-only trusted scan', () => {
  const workflow = readWorkflow(TRUSTED);
  expect(workflow.on).toEqual({
    pull_request_target: {
      branches: ['staging', 'master'],
      types: ['opened', 'synchronize', 'reopened', 'edited'],
    },
  });
  expect(workflow.permissions).toEqual({ contents: 'read' });
  expect(workflow.concurrency).toEqual({
    group: '${{ github.workflow }}-${{ github.event.pull_request.number }}',
    'cancel-in-progress': true,
  });
  const jobs = jobsOf(workflow);
  expect(Object.keys(jobs)).toEqual(['trusted-range']);
  const steps = stepsOf(jobs['trusted-range']);
  expect(steps[0]).toMatchObject({
    uses: 'actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683',
    with: {
      ref: '${{ github.event.pull_request.base.sha }}',
      'fetch-depth': 0,
      'persist-credentials': false,
    },
  });
  expect(steps[1]).toMatchObject({
    uses: 'actions/setup-node@49933ea5288caeca8642d1e84afbd3f7d6820020',
    with: { 'node-version-file': '.nvmrc', 'package-manager-cache': false },
  });
  expect(steps[2]).toMatchObject({
    id: 'fetch',
    env: {
      BASE_REF: '${{ github.event.pull_request.base.ref }}',
      HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      GITHUB_TOKEN: '${{ github.token }}',
    },
    run: 'node scripts/ci.mjs --fetch',
  });
  expect(steps[3]).toMatchObject({
    env: {
      BASE_SHA: '${{ github.event.pull_request.base.sha }}',
      HEAD_SHA: '${{ github.event.pull_request.head.sha }}',
      CURRENT_BASE_SHA: '${{ steps.fetch.outputs.base }}',
    },
    run: 'node scripts/ci.mjs --range "$BASE_SHA" "$HEAD_SHA" "$CURRENT_BASE_SHA"',
  });
  expect(steps).toHaveLength(4);
  expect(readFileSync(TRUSTED, 'utf8')).not.toMatch(/\$\{\{\s*secrets\./);
});

it('bounds jobs and caches runtime Mongo binaries in both jobs that need them', () => {
  const jobs = jobsOf(readWorkflow(WORKFLOW));
  for (const [id, timeout] of [
    ['range-scan', 10],
    ['quality', 30],
    ['installer', 30],
  ] as const) {
    expect(jobs[id]).toMatchObject({ 'runs-on': 'ubuntu-24.04', 'timeout-minutes': timeout });
  }
  expect(jobsOf(readWorkflow(TRUSTED))['trusted-range']).toMatchObject({
    'runs-on': 'ubuntu-24.04',
    'timeout-minutes': 10,
  });
  for (const id of ['quality', 'installer']) {
    const steps = stepsOf(jobs[id]);
    expect(steps[3]).toMatchObject({ id: 'mongo', run: 'node scripts/ci.mjs --cache' });
    expect(steps[4]).toEqual({
      uses: 'actions/cache@5a3ec84eff668545956fd18022155c47e93e2684',
      with: {
        path: '${{ steps.mongo.outputs.path }}',
        key: '${{ runner.os }}-${{ runner.arch }}-${{ steps.mongo.outputs.key }}',
      },
    });
  }
});

it('protects scanner ownership and schedules grouped weekly action updates', () => {
  expect(
    readFileSync(new URL('../../../.github/CODEOWNERS', import.meta.url), 'utf8')
      .trim()
      .split('\n'),
  ).toEqual([
    '/.github/ @Mohammed-Abdelhady',
    '/scripts/ci.mjs @Mohammed-Abdelhady',
    '/scripts/ci/ @Mohammed-Abdelhady',
    '/scripts/guardrails/ @Mohammed-Abdelhady',
    '/scripts/check-hard-bans.mjs @Mohammed-Abdelhady',
    '/scripts/check-hard-bans.test.mjs @Mohammed-Abdelhady',
    '/packages/create-nest-next-auth/scripts/sync-template.mjs @Mohammed-Abdelhady',
    '/packages/create-nest-next-auth/src/constants/template-tests.json @Mohammed-Abdelhady',
    '/.nvmrc @Mohammed-Abdelhady',
    '/package.json @Mohammed-Abdelhady',
    '/pnpm-workspace.yaml @Mohammed-Abdelhady',
  ]);
  const dependabot = readWorkflow(new URL('../../../.github/dependabot.yml', import.meta.url));
  expect(dependabot.updates).toContainEqual({
    'package-ecosystem': 'github-actions',
    directory: '/',
    schedule: { interval: 'weekly' },
    groups: { actions: { patterns: ['*'] } },
  });
});
