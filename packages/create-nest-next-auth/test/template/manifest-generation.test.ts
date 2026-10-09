import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { loadManifest } from '../../src/manifest/load.js';
import { resolvePlan } from '../../src/manifest/plan.js';
import { describePlanErrors } from '../../src/report/summary.js';

const REPO_ROOT = fileURLToPath(new URL('../../../..', import.meta.url));

it.each([
  { dimension: 'targets', field: 'files', value: ['frontend/**'] },
  { dimension: 'targets', field: 'workspaces', value: ['frontend'] },
  { dimension: 'targets', field: 'envFiles', value: ['frontend/.env.example'] },
  { dimension: 'shared', field: 'files', value: ['mobile/auth/**'] },
  { dimension: 'shared', field: 'workspaces', value: ['mobile/auth'] },
])('rejects unapplied $dimension.$field ownership', async ({ dimension, field, value }) => {
  const root = await mkdtemp(join(tmpdir(), 'manifest-generation-'));
  try {
    const raw = JSON.parse(await readFile(join(REPO_ROOT, 'template.manifest.json'), 'utf8'));
    if (dimension === 'targets') raw.targets.web[field] = value;
    else raw.shared['native-core'][field] = value;
    await writeFile(join(root, 'template.manifest.json'), JSON.stringify(raw));
    await expect(loadManifest(root)).rejects.toThrow(/generation does not apply/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it.each(['native-expo', 'native-cli'])('refuses the planned target %s', async (id) => {
  const manifest = await loadManifest(REPO_ROOT);
  const plan = resolvePlan(manifest, { targets: [id] });
  expect(plan.targets).toEqual([]);
  expect(plan.errors).toContainEqual({ id, reason: 'planned' });
  expect(describePlanErrors(manifest, plan.errors).join('\n')).toMatch(new RegExp(id));
});

it('rejects advertising an available native target before generation supports it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'manifest-native-'));
  try {
    const raw = JSON.parse(await readFile(join(REPO_ROOT, 'template.manifest.json'), 'utf8'));
    raw.targets['native-expo'].status = 'available';
    await writeFile(join(root, 'template.manifest.json'), JSON.stringify(raw));
    await expect(loadManifest(root)).rejects.toThrow(/native-expo.*must remain planned/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('still loads a legacy generation manifest with the web default', async () => {
  const root = await mkdtemp(join(tmpdir(), 'manifest-legacy-'));
  try {
    const raw = JSON.parse(await readFile(join(REPO_ROOT, 'template.manifest.json'), 'utf8'));
    await writeFile(
      join(root, 'template.manifest.json'),
      JSON.stringify({ features: raw.features, core: raw.core }),
    );
    const manifest = await loadManifest(root);
    const plan = resolvePlan(manifest, {});
    expect({ targets: plan.targets, shared: plan.shared, errors: plan.errors }).toEqual({
      targets: ['web'],
      shared: [],
      errors: [],
    });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
