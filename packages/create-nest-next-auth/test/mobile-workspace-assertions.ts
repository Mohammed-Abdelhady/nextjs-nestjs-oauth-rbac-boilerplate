import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { parse } from 'yaml';
import { listFiles } from '../src/utils/fs.js';

export async function expectPlannedMobileWorkspaceIsPruned(
  project: string,
  templateRoot: string,
): Promise<void> {
  expect(existsSync(join(project, 'mobile'))).toBe(false);
  expect(existsSync(join(project, 'backend/test/native-auth-engine.e2e-spec.ts'))).toBe(false);
  expect(existsSync(join(project, 'backend/test/utils/native-auth-engine-harness.ts'))).toBe(false);

  const root = JSON.parse(readFileSync(join(project, 'package.json'), 'utf8')) as {
    workspaces?: string[];
  };
  expect(root.workspaces).not.toContain('mobile/*');

  const backend = JSON.parse(readFileSync(join(project, 'backend/package.json'), 'utf8')) as {
    devDependencies?: Record<string, string>;
  };
  expect(backend.devDependencies?.['@app/native-auth']).toBeUndefined();

  const workspace = parse(readFileSync(join(project, 'pnpm-workspace.yaml'), 'utf8')) as {
    packages: string[];
  };
  const packageFiles = (await listFiles(project)).filter(
    (file) => file === 'package.json' || file.endsWith('/package.json'),
  );
  const nativeAuthManifests = packageFiles.filter((file) =>
    readFileSync(join(project, file), 'utf8').includes('@app/native-auth'),
  );
  expect({
    mobileWorkspaces: workspace.packages.filter((pattern) => pattern.startsWith('mobile/')),
    nativeAuthManifests,
  }).toEqual({ mobileWorkspaces: [], nativeAuthManifests: [] });

  const manifest = JSON.parse(
    readFileSync(join(templateRoot, 'template.manifest.json'), 'utf8'),
  ) as {
    core: { alwaysRemoveFiles: string[] };
    shared: { 'native-core': { files: string[]; workspaces: string[] } };
  };
  expect(manifest.core.alwaysRemoveFiles).toContain('mobile/**');
  expect(manifest.shared['native-core'].files).toContain('mobile/auth/**');
  expect(manifest.shared['native-core'].workspaces).toContain('mobile/auth');
}
