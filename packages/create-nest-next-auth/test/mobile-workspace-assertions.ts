import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';

export function expectPlannedMobileWorkspaceIsPruned(project: string, templateRoot: string): void {
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

  const lock = JSON.parse(readFileSync(join(project, 'package-lock.json'), 'utf8')) as {
    packages?: Record<string, { devDependencies?: Record<string, string>; workspaces?: string[] }>;
  };
  expect(lock.packages?.['']?.workspaces).not.toContain('mobile/*');
  expect(lock.packages?.['mobile/auth']).toBeUndefined();
  expect(lock.packages?.['node_modules/@app/native-auth']).toBeUndefined();
  expect(lock.packages?.backend?.devDependencies?.['@app/native-auth']).toBeUndefined();

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
