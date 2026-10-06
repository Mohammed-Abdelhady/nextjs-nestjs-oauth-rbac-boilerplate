import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { pruneRootPackageLock } from '../src/prune/package-lock.js';

const roots: string[] = [];

async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cna-lock-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('pruneRootPackageLock', () => {
  it('removes missing workspace links without treating bundled dependencies as workspaces', async () => {
    const root = await makeRoot();
    const packages = {
      '': { workspaces: ['backend', 'mobile/*'] },
      backend: { name: 'backend', version: '1.0.0' },
      'node_modules/backend': { resolved: 'backend', link: true },
      'backend/node_modules/in-bundle': { inBundle: true, version: '1.0.0' },
      'mobile/auth': { name: '@app/native-auth', version: '0.1.0' },
      'node_modules/@app/native-auth': { resolved: 'mobile/auth', link: true },
    };
    await writeFile(join(root, 'package.json'), JSON.stringify({ workspaces: ['backend'] }));
    await writeFile(
      join(root, 'package-lock.json'),
      JSON.stringify({ lockfileVersion: 3, packages }),
    );
    await mkdir(join(root, 'backend'), { recursive: true });
    await writeFile(join(root, 'backend/package.json'), '{}');

    await pruneRootPackageLock(root);

    const lock = JSON.parse(await readFile(join(root, 'package-lock.json'), 'utf8')) as {
      packages: Record<string, unknown>;
    };
    expect(lock.packages['mobile/auth']).toBeUndefined();
    expect(lock.packages['node_modules/@app/native-auth']).toBeUndefined();
    expect(lock.packages['backend/node_modules/in-bundle']).toEqual({
      inBundle: true,
      version: '1.0.0',
    });
  });
});
