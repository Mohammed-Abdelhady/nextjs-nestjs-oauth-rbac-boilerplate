import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadManifest } from '../src/manifest/load.js';
import { availableFeatures, defaultFeatureIds, resolveSelection } from '../src/manifest/select.js';
import { ManifestError, validateManifest } from '../src/manifest/validate.js';
import { FEATURE_KIND_ORDER } from '../src/constants/index.js';
import { listFiles } from '../src/utils/fs.js';

const REPO_ROOT = fileURLToPath(new URL('../../..', import.meta.url));

function feature(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    label: 'Alpha',
    description: 'Sign in with Alpha.',
    kind: 'oauth',
    default: true,
    files: [],
    envVars: [],
    requires: [],
    docs: [],
    ...overrides,
  };
}

describe('validateManifest', () => {
  it('accepts a minimal manifest', () => {
    const manifest = validateManifest({
      features: { alpha: feature() },
      core: { alwaysRemoveFiles: [] },
    });
    expect(manifest.features.alpha.status).toBe('available');
  });

  it('rejects an unknown kind', () => {
    expect(() =>
      validateManifest({
        features: { a: feature({ kind: 'sms' }) },
        core: { alwaysRemoveFiles: [] },
      }),
    ).toThrow(ManifestError);
  });

  it('rejects a missing label', () => {
    expect(() =>
      validateManifest({
        features: { a: feature({ label: '' }) },
        core: { alwaysRemoveFiles: [] },
      }),
    ).toThrow(/label must be a non-empty string/);
  });

  it('rejects paths that escape the project', () => {
    expect(() =>
      validateManifest({
        features: { a: feature({ files: ['../outside.ts'] }) },
        core: { alwaysRemoveFiles: [] },
      }),
    ).toThrow(/relative posix path/);
  });

  it('rejects a requirement that does not exist', () => {
    expect(() =>
      validateManifest({
        features: { a: feature({ requires: ['ghost'] }) },
        core: { alwaysRemoveFiles: [] },
      }),
    ).toThrow(/does not exist/);
  });

  it('rejects an available feature requiring a planned one', () => {
    expect(() =>
      validateManifest({
        features: {
          a: feature({ requires: ['b'] }),
          b: feature({ status: 'planned', default: false }),
        },
        core: { alwaysRemoveFiles: [] },
      }),
    ).toThrow(/requires planned feature/);
  });

  it('reports every problem at once', () => {
    try {
      validateManifest({
        features: { Bad_Id: feature({ kind: 'sms', default: 'yes' }) },
        core: {},
      });
      expect.unreachable('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ManifestError);
      expect((error as ManifestError).problems.length).toBeGreaterThan(2);
    }
  });
});

describe('the repository manifest', () => {
  it('is valid', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    expect(Object.keys(manifest.features).length).toBeGreaterThan(4);
  });

  it('preselects email and password with the three first-party providers', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    expect(defaultFeatureIds(manifest)).toEqual([
      'email-password',
      'google',
      'github',
      'facebook',
    ]);
  });

  it('keeps hidden features out of the prompt and off the defaults', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    const hidden = availableFeatures(manifest).filter(({ feature }) => feature.kind === 'hidden');

    expect(hidden.map(({ id }) => id)).toEqual(['oauth-core']);
    for (const { id, feature } of hidden) {
      expect(feature.default, `${id} is hidden and cannot be a default`).toBe(false);
      expect(FEATURE_KIND_ORDER).not.toContain(feature.kind);
    }
  });

  it('gives every planned feature an empty file list', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    for (const [id, entry] of Object.entries(manifest.features)) {
      if (entry.status !== 'planned') continue;
      expect(entry.files, `${id} is planned but claims files`).toEqual([]);
    }
  });

  it('never lists the same file under two features', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    const seen = new Map<string, string>();
    for (const [id, entry] of Object.entries(manifest.features)) {
      for (const path of [...entry.files, ...entry.docs]) {
        expect(seen.has(path), `${path} is claimed by ${seen.get(path)} and ${id}`).toBe(false);
        seen.set(path, id);
      }
    }
  });

  it('drops unknown ids from a selection and pulls in requirements', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    const selection = resolveSelection(manifest, ['google', 'apple', 'nope']);

    expect(selection.selected).toEqual(['oauth-core', 'google', 'apple']);
    expect(selection.added).toEqual(['oauth-core']);
    expect(selection.rejected).toEqual(['nope']);
    expect(selection.removed).toContain('facebook');
  });

  it('claims every file that exists, so a delete list is never stale', async () => {
    const manifest = await loadManifest(REPO_ROOT);
    const present = new Set(await listFiles(REPO_ROOT));

    for (const [id, entry] of Object.entries(manifest.features)) {
      for (const path of entry.files) {
        if (path.includes('*')) continue;
        expect(present.has(path), `features.${id} lists ${path}, which does not exist`).toBe(true);
      }
      for (const path of entry.docs) {
        expect(present.has(path), `features.${id} lists doc ${path}, which does not exist`).toBe(
          true,
        );
      }
    }
  });
});
