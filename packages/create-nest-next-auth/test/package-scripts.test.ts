import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { prunePackageScripts, pruneRootPackage } from '../src/prune/package-scripts.js';

function packageJson(scripts: Record<string, string>): Record<string, unknown> {
  return { name: 'app', private: true, scripts };
}

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cna-scripts-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('prunePackageScripts', () => {
  it('drops a script whose command runs a deleted file', () => {
    const result = prunePackageScripts(
      packageJson({ 'setup:prod': 'node scripts/setup-production.js', build: 'nest build' }),
      ['scripts/setup-production.js'],
    );

    expect(result.scripts).toEqual({ build: 'nest build' });
  });

  it('keeps a script whose file was not deleted', () => {
    const result = prunePackageScripts(packageJson({ init: 'node scripts/init.js' }), [
      'scripts/setup-production.js',
    ]);

    expect(result.scripts).toEqual({ init: 'node scripts/init.js' });
  });

  it('strips a deleted file from a node --test argument list', () => {
    const result = prunePackageScripts(
      packageJson({
        'test:config':
          'node --test scripts/config-transforms.test.mjs scripts/check-hard-bans.test.mjs',
      }),
      ['scripts/config-transforms.test.mjs'],
    );

    expect(result.scripts).toEqual({
      'test:config': 'node --test scripts/check-hard-bans.test.mjs',
    });
  });

  it('matches a deleted path written with a leading ./', () => {
    const result = prunePackageScripts(
      packageJson({ deploy: 'node ./scripts/setup-production.js' }),
      ['scripts/setup-production.js'],
    );

    expect(result.scripts).toEqual({});
  });

  it('removes only the deleted part of a simple && chain', () => {
    const result = prunePackageScripts(
      packageJson({ check: 'npm run lint && node scripts/setup-production.js' }),
      ['scripts/setup-production.js'],
    );

    expect(result.scripts).toEqual({ check: 'npm run lint' });
  });

  it('drops a && chain when every part runs a deleted file', () => {
    const result = prunePackageScripts(
      packageJson({
        deploy: 'node scripts/setup-production.js && node scripts/setup-production.js',
      }),
      ['scripts/setup-production.js'],
    );

    expect(result.scripts).toEqual({});
  });

  it('fails loudly when a deleted file sits in a non-&& operator chain', () => {
    for (const command of [
      'npm run lint; node scripts/setup-production.js',
      'npm run lint || node scripts/setup-production.js',
      'npm run lint | node scripts/setup-production.js',
    ]) {
      expect(() =>
        prunePackageScripts(packageJson({ check: command }), ['scripts/setup-production.js']),
      ).toThrow(/Script "check" mixes a deleted file with shell operators/);
    }
  });

  it('leaves a package without scripts alone', () => {
    const result = prunePackageScripts({ name: 'app' }, ['scripts/setup-production.js']);

    expect(result).toEqual({ name: 'app' });
  });
});

describe('pruneRootPackage', () => {
  it('returns false for a missing file', async () => {
    const root = await tempRoot();

    await expect(pruneRootPackage(root, [])).resolves.toBe(false);
  });

  it('rejects invalid JSON with the file name', async () => {
    const root = await tempRoot();
    await writeFile(join(root, 'package.json'), '{ not json', 'utf8');

    await expect(pruneRootPackage(root, [])).rejects.toThrow(/Could not parse package\.json/);
  });
});
