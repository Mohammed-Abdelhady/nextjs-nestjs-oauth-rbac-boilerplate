import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { parse } from 'yaml';
import { listFiles } from '../src/utils/fs.js';

const MOBILE_FOLDERS = [
  'mobile',
  'mobile/adapters',
  'mobile/auth',
  'mobile/cli',
  'mobile/expo',
  'mobile/metro',
];
const MOBILE_PACKAGES = [
  '@app/native-adapters',
  '@app/native-auth',
  '@app/metro-config',
  '@app/mobile-cli',
  '@app/mobile-expo',
];
const NATIVE_RUNTIMES = ['expo', 'react-native'];
const DEPENDENCY_SECTIONS = ['dependencies', 'devDependencies', 'peerDependencies'] as const;

type PackageManifest = Partial<
  Record<(typeof DEPENDENCY_SECTIONS)[number], Record<string, string>>
>;

function dependsOnNativeRuntime(source: string): boolean {
  const manifest = JSON.parse(source) as PackageManifest;
  return DEPENDENCY_SECTIONS.some((section) =>
    NATIVE_RUNTIMES.some((name) => manifest[section]?.[name] !== undefined),
  );
}

export async function expectPlannedMobileWorkspaceIsPruned(
  project: string,
  templateRoot: string,
): Promise<void> {
  expect(MOBILE_FOLDERS.filter((folder) => existsSync(join(project, folder)))).toEqual([]);
  expect(
    existsSync(join(project, 'backend/test/native/engine/native-auth-engine.e2e-spec.ts')),
  ).toBe(false);
  expect(existsSync(join(project, 'backend/test/utils/native/native-auth-engine-harness.ts'))).toBe(
    false,
  );

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
    minimumReleaseAgeExclude?: string[];
    minimumReleaseAgeStrict?: boolean;
  };
  expect({
    releaseAgeExceptions: workspace.minimumReleaseAgeExclude ?? [],
    releaseAgeStrict: workspace.minimumReleaseAgeStrict,
  }).toEqual({ releaseAgeExceptions: [], releaseAgeStrict: true });
  const packageFiles = (await listFiles(project))
    .filter((file) => file === 'package.json' || file.endsWith('/package.json'))
    .map((file) => ({ file, source: readFileSync(join(project, file), 'utf8') }));
  expect({
    mobileWorkspaces: workspace.packages.filter((pattern) => pattern.startsWith('mobile/')),
    mobilePackageManifests: packageFiles
      .filter(({ source }) => MOBILE_PACKAGES.some((name) => source.includes(name)))
      .map(({ file }) => file),
    nativeRuntimeManifests: packageFiles
      .filter(({ source }) => dependsOnNativeRuntime(source))
      .map(({ file }) => file),
  }).toEqual({ mobileWorkspaces: [], mobilePackageManifests: [], nativeRuntimeManifests: [] });

  const manifest = JSON.parse(
    readFileSync(join(templateRoot, 'template.manifest.json'), 'utf8'),
  ) as {
    core: { alwaysRemoveFiles: string[] };
    shared: { 'native-core': { files: string[]; workspaces: string[] } };
  };
  expect(manifest.core.alwaysRemoveFiles).toEqual(
    expect.arrayContaining([
      'mobile/**',
      'mobile/adapters/**',
      'mobile/cli/**',
      'mobile/expo/**',
      'mobile/metro/**',
    ]),
  );
  expect(manifest.shared['native-core'].files).toContain('mobile/auth/**');
  expect(manifest.shared['native-core'].workspaces).toContain('mobile/auth');
}
