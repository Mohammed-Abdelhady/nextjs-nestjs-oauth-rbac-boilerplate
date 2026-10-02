import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadManifest } from '../src/manifest/load.js';
import { availableFeatures, resolveSelection } from '../src/manifest/select.js';
import type { Manifest } from '../src/types.js';
import {
  buildCli,
  compareWithRepository,
  linkDependencies,
  REPO_ROOT,
  runTool,
  scaffold,
} from './combination-helpers.js';
import {
  expectDriftMatches,
  expectLints,
  expectPrunedShared,
  expectTypechecks,
} from './combination-scenarios.js';
import { verifyFeatureAvailability } from './feature-runtime.js';

/**
 * Every feature combination a generated project has to compile in. Slow by
 * nature: it builds the CLI, scaffolds seven trees and runs three typechecks,
 * the drift spec, and a frontend check against the pruned shared package over
 * each. Run it with `npm run test:combinations -w packages/create-nest-next-auth`.
 */

const ALL_OAUTH = [
  'google',
  'github',
  'facebook',
  'microsoft',
  'apple',
  'discord',
  'linkedin',
  'gitlab',
  'x',
  'slack',
  'twitch',
  'oidc',
];

interface Combination {
  name: string;
  features: string[];
}

const COMBINATIONS: Combination[] = [
  { name: 'email and password on its own', features: ['email-password'] },
  { name: 'magic link on its own', features: ['magic-link'] },
  { name: 'email and password with Google', features: ['email-password', 'google'] },
  { name: 'email and password with TOTP', features: ['email-password', 'totp'] },
  { name: 'passkeys on their own', features: ['passkeys'] },
  {
    name: 'both second factors and every provider',
    features: ['email-password', 'totp', 'passkeys', ...ALL_OAUTH],
  },
];

let workspace = '';
let manifest: Manifest;
let built = { ok: false, output: '' };

/** Every feature the CLI can be asked for. Hidden ids arrive through `requires`. */
function everything(): string[] {
  return availableFeatures(manifest)
    .filter(({ feature }) => feature.kind !== 'hidden')
    .map(({ id }) => id);
}

beforeAll(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'cna-combinations-'));
  manifest = await loadManifest(REPO_ROOT);
  built = await buildCli();
});

afterAll(() => {
  if (workspace !== '') rmSync(workspace, { recursive: true, force: true });
});

/** Scaffolds one selection and returns where it landed. */
async function generate(name: string, features: string[]): Promise<string> {
  const project = join(workspace, name.replace(/\W+/g, '-'));
  const result = await scaffold(project, features);
  expect(result.ok, result.output).toBe(true);
  linkDependencies(project);
  const availability = verifyFeatureAvailability(project, features);
  expect(availability.ok, availability.output).toBe(true);
  return project;
}

describe('generated projects', () => {
  it('builds the CLI first', () => {
    expect(built.ok, built.output).toBe(true);
  });

  it.each(COMBINATIONS)('typechecks and lints with $name', async ({ name, features }) => {
    const project = await generate(name, features);
    await expectTypechecks(project);
    await expectDriftMatches(project);
    await expectPrunedShared(project);
    await expectLints(project);
    if (features.includes('google') && features.length === 2) {
      const api = await runTool(
        process.execPath,
        [
          join(REPO_ROOT, 'node_modules/jest/bin/jest.js'),
          '--config',
          'test/jest-e2e.json',
          '--runInBand',
          '--runTestsByPath',
          'test/app.boot.e2e-spec.ts',
        ],
        { cwd: join(project, 'backend') },
      );
      expect(api.ok, api.output).toBe(true);
    }
  });

  it('typechecks and lints with everything the manifest offers', async () => {
    const requested = everything();
    const project = await generate('everything', requested);
    await expectTypechecks(project);
    await expectDriftMatches(project);
    await expectPrunedShared(project);
    await expectLints(project);

    // Retained application and API test files differ only by feature markers.
    const selected = resolveSelection(manifest, requested).selected;
    const markerIds = [...Object.keys(manifest.features), ...Object.keys(manifest.options)];
    const kept = [...selected, ...Object.keys(manifest.options)];
    const differences = await compareWithRepository(project, kept, markerIds);
    expect(differences, JSON.stringify(differences, null, 2)).toEqual([]);
  });

  it('pulls OAuth core in behind a provider without offering it', () => {
    const selection = resolveSelection(manifest, ['email-password', 'google']);

    expect(selection.selected).toContain('oauth-core');
    expect(manifest.features['oauth-core'].kind).toBe('hidden');
  });
});
