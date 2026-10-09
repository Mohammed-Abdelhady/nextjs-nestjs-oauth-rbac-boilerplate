import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { unclassifiedMutationNames } from './mutationSweepGuard';
import { CONVERTED, EXCEPTIONS } from './invalidationRefetchCases';
import { UNTAGGED } from './untaggedRefetchCases';
import { authApi } from '@/modules/auth/store/authApi';

/** Source folders the features own; their files may be absent. */
const FEATURE_OWNED_PREFIXES = [
  'src/modules/auth/methods/magic-link/',
  'src/modules/passkeys/',
  'src/modules/two-factor/',
  'src/modules/oauth/',
  'src/modules/account/api/accountLinkingApi.ts',
  'src/modules/account/api/profileSyncApi.ts',
];

/** Files the core sweep always imports and its guard always classifies. */
const CORE_DECLARED = [
  'src/store/api/baseApi.ts',
  'src/modules/auth/store/authApi.ts',
  'src/modules/auth/api/authMethodsApi.ts',
  'src/modules/roles/api/rolesApi.ts',
  'src/modules/permissions/api/permissionsApi.ts',
  'src/modules/sessions/api/sessionsApi.ts',
  'src/modules/users/api/usersApi.ts',
];

/** Every ts file under src, relative to the frontend root. */
function tsFilesUnder(rootDir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(rootDir, { withFileTypes: true })) {
    const path = join(rootDir, entry.name);
    if (entry.isDirectory()) {
      for (const child of tsFilesUnder(path)) found.push(child);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      found.push(path);
    }
  }
  return found;
}

describe('mutation sweep coverage', () => {
  it('classifies every mutation endpoint its import graph holds', () => {
    const classified = [
      ...[...CONVERTED, ...EXCEPTIONS, ...UNTAGGED].map((mutation) => mutation.name),
    ];
    expect(new Set(classified).size).toBe(classified.length);
    // The endpoint objects are shared, so one registry lists every endpoint
    // this file's import graph holds; a second slice would repeat it.
    expect(unclassifiedMutationNames(authApi, classified)).toEqual([]);
  });

  /** This reads the file list on purpose: it guards the slice-file structure
   * the classification guards above depend on, so a slice with no guard
   * anywhere cannot appear unnoticed. */
  it('declares every source file that injects endpoints', () => {
    const srcDir = fileURLToPath(new URL('../../../../', import.meta.url));
    const injectors = tsFilesUnder(srcDir)
      // Test files mention the call in their lists; the structure guard is
      // about production API slices.
      .filter((file) => !file.includes('__tests__'))
      .filter((file) => readFileSync(file, 'utf8').includes('injectEndpoints('))
      .map((file) => file.slice(srcDir.length));

    const owned = (file: string) =>
      FEATURE_OWNED_PREFIXES.some((prefix) => file.startsWith(prefix));
    for (const file of CORE_DECLARED) {
      expect(existsSync(join(srcDir, file)), `${file} must exist`).toBe(true);
    }
    expect(injectors.filter((file) => !CORE_DECLARED.includes(file) && !owned(file))).toEqual([]);
  });
});
