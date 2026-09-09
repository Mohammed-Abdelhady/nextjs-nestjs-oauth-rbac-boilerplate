import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadManifest } from '../src/manifest/load.js';
import { availableFeatures, resolveSelection } from '../src/manifest/select.js';
import type { Manifest } from '../src/types.js';
import { verifyFeatureAvailability } from './feature-runtime.js';
import {
  buildCli,
  compareWithRepository,
  linkDependencies,
  REPO_ROOT,
  scaffold,
  typecheck,
} from './combination-helpers.js';

/**
 * Every combination a generated project has to compile in. Slow by nature: it
 * builds the CLI, scaffolds seven trees and runs two typechecks over each.
 * Run it with `npm run test:combinations -w packages/create-nest-next-auth`.
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

function everything(): string[] {
  return availableFeatures(manifest).map(({ id }) => id);
}

beforeAll(async () => {
  workspace = mkdtempSync(join(tmpdir(), 'cna-combinations-'));
  manifest = await loadManifest(REPO_ROOT);
  built = buildCli();
});

afterAll(() => {
  if (workspace !== '') rmSync(workspace, { recursive: true, force: true });
});

/** Scaffolds one selection and returns where it landed. */
function generate(name: string, features: string[]): string {
  const project = join(workspace, name.replace(/\W+/g, '-'));
  const result = scaffold(project, features);
  expect(result.ok, result.output).toBe(true);
  linkDependencies(project);
  const availability = verifyFeatureAvailability(project, features);
  expect(availability.ok, availability.output).toBe(true);
  return project;
}

function expectTypechecks(project: string): void {
  const backend = typecheck(project, 'backend');
  expect(backend.ok, backend.output).toBe(true);
  const frontend = typecheck(project, 'frontend');
  expect(frontend.ok, frontend.output).toBe(true);
}

describe('generated projects', () => {
  it('builds the CLI first', () => {
    expect(built.ok, built.output).toBe(true);
  });

  it.each(COMBINATIONS)('typechecks with $name', ({ name, features }) => {
    expectTypechecks(generate(name, features));
  });

  it('typechecks with everything the manifest offers', async () => {
    const features = everything();
    const project = generate('everything', features);
    expectTypechecks(project);

    // Retained application and API test files differ only by feature markers.
    const differences = await compareWithRepository(project, features);
    expect(differences, JSON.stringify(differences, null, 2)).toEqual([]);
  });

  it('pulls OAuth core in behind a provider without offering it', () => {
    const selection = resolveSelection(manifest, ['email-password', 'google']);

    expect(selection.selected).toContain('oauth-core');
    expect(selection.added).toEqual(['oauth-core']);
    expect(manifest.features['oauth-core'].kind).toBe('hidden');
  });
});
