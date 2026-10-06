import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT_PACKAGE_JSON, ROOT_PACKAGE_LOCK } from '../constants/index.js';
import { isRecord } from '../manifest/read.js';
import { listFiles, readFileIfExists } from '../utils/fs.js';

export async function pruneRootPackageLock(root: string): Promise<boolean> {
  const lockPath = join(root, ROOT_PACKAGE_LOCK);
  const packageRaw = await readFileIfExists(join(root, ROOT_PACKAGE_JSON));
  const lockRaw = await readFileIfExists(lockPath);
  if (packageRaw === undefined || lockRaw === undefined) return false;
  const packageJson: unknown = JSON.parse(packageRaw);
  const lock: unknown = JSON.parse(lockRaw);
  if (!isRecord(packageJson) || !isRecord(lock) || !isRecord(lock.packages)) return false;

  const files = await listFiles(root);
  const workspaces = Array.isArray(packageJson.workspaces) ? packageJson.workspaces : [];
  const rootEntry = isRecord(lock.packages['']) ? lock.packages[''] : undefined;
  const removedRoots = findRemovedWorkspaceRoots(lock.packages, files);
  const removedNames = findRemovedWorkspaceNames(lock.packages, removedRoots);
  let changed = pruneWorkspaceLinks(lock.packages, removedRoots, removedNames);
  if (rootEntry && JSON.stringify(rootEntry.workspaces) !== JSON.stringify(workspaces)) {
    rootEntry.workspaces = workspaces;
    changed = true;
  }
  if (!changed) return false;
  await writeFile(lockPath, `${JSON.stringify(lock, null, 2)}\n`, 'utf8');
  return true;
}

function findRemovedWorkspaceRoots(
  packages: Record<string, unknown>,
  files: readonly string[],
): Set<string> {
  const removed = new Set<string>();
  for (const entry of Object.values(packages)) {
    if (!isRecord(entry) || entry.link !== true || typeof entry.resolved !== 'string') continue;
    if (!files.includes(`${entry.resolved}/package.json`)) removed.add(entry.resolved);
  }
  return removed;
}

function pruneWorkspaceLinks(
  packages: Record<string, unknown>,
  removedRoots: Set<string>,
  removedNames: ReadonlySet<string>,
): boolean {
  let changed = false;
  for (const [path, value] of Object.entries(packages)) {
    if (path === '') {
      changed = pruneDependencyReferences(value, removedNames) || changed;
      continue;
    }
    if (isRecord(value)) changed = pruneDependencyReferences(value, removedNames) || changed;
    const workspaceRoot = isRecord(value) ? value.resolved : undefined;
    const removedPath = [...removedRoots].some(
      (root) => path === root || path.startsWith(`${root}/`) || workspaceRoot === root,
    );
    if (!removedPath) continue;
    delete packages[path];
    changed = true;
  }
  return changed;
}

function findRemovedWorkspaceNames(
  packages: Record<string, unknown>,
  removedRoots: ReadonlySet<string>,
): Set<string> {
  const names = new Set<string>();
  for (const root of removedRoots) {
    const entry = packages[root];
    if (isRecord(entry) && typeof entry.name === 'string') names.add(entry.name);
  }
  return names;
}

function pruneDependencyReferences(entry: unknown, removedNames: ReadonlySet<string>): boolean {
  if (!isRecord(entry)) return false;
  let changed = false;
  for (const group of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const dependencies = entry[group];
    if (!isRecord(dependencies)) continue;
    for (const name of removedNames) {
      if (!Object.hasOwn(dependencies, name)) continue;
      delete dependencies[name];
      changed = true;
    }
  }
  return changed;
}
