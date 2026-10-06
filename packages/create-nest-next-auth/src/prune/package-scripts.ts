import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT_PACKAGE_JSON, ROOT_PACKAGE_LOCK } from '../constants/index.js';
import TEMPLATE_TEST_POLICY from '../constants/template-tests.json' with { type: 'json' };
import { isRecord } from '../manifest/read.js';
import { listFiles, readFileIfExists } from '../utils/fs.js';
import { matchesGlob } from '../utils/glob.js';

const REPOSITORY_TEST_PATHS = TEMPLATE_TEST_POLICY.EXCLUDED_PATH_PATTERNS.map(
  (pattern) => new RegExp(pattern),
);

/** Removes a leading `./` so a command token matches a manifest path. */
function asPath(token: string): string {
  return token.startsWith('./') ? token.slice(2) : token;
}

/** True when a `node --test` list has no test file left after the filter. */
function hasTestFile(tokens: string[]): boolean {
  return tokens.some((token, index) => index > 1 && !token.startsWith('-') && token !== 'node');
}

/** A shell operator other than a simple `&&` chain. */
const OTHER_SHELL_OPERATOR = /(\|\||;|\|(?!=)|(?<!&)&(?!&))/;

/**
 * Drops deleted files and repository-only tests from generated commands.
 * Other tests and scripts keep the feature-pruner's existing behavior.
 */
export function prunePackageScripts(
  packageJson: Record<string, unknown>,
  deletedFiles: readonly string[],
): Record<string, unknown> {
  if (!isRecord(packageJson.scripts)) return packageJson;

  const deleted = new Set(deletedFiles);
  const isDeleted = (token: string): boolean =>
    deleted.has(asPath(token)) ||
    REPOSITORY_TEST_PATHS.some((pattern) => pattern.test(asPath(token)));
  const namesDeleted = (command: string): boolean => command.split(/\s+/).some(isDeleted);
  const scripts: Record<string, unknown> = {};

  for (const [name, command] of Object.entries(packageJson.scripts)) {
    if (typeof command !== 'string' || !namesDeleted(command)) {
      scripts[name] = command;
      continue;
    }

    const tokens = command.split(/\s+/);
    if (tokens.includes('--test')) {
      const kept = tokens.filter((token) => !isDeleted(token));
      if (!hasTestFile(kept)) continue;
      scripts[name] = kept.join(' ');
      continue;
    }

    if (command.includes('&&')) {
      const kept = command.split(' && ').filter((part) => !namesDeleted(part));
      if (kept.length === 0) continue;
      scripts[name] = kept.join(' && ');
      continue;
    }

    if (OTHER_SHELL_OPERATOR.test(command)) {
      throw new Error(
        `Script "${name}" mixes a deleted file with shell operators; edit it by hand.`,
      );
    }

    // A single command that exists to run a deleted file goes with it.
  }

  if (
    scripts['test:config:all'] !== undefined &&
    scripts['test:config:all'] === scripts['test:config']
  )
    delete scripts['test:config:all'];

  return { ...packageJson, scripts };
}

export function prunePackageWorkspaces(
  packageJson: Record<string, unknown>,
  existingFiles: readonly string[],
): Record<string, unknown> {
  if (!Array.isArray(packageJson.workspaces)) return packageJson;
  const workspaces = packageJson.workspaces.filter((workspace) => {
    if (typeof workspace !== 'string') return true;
    return existingFiles.some((file) => matchesGlob(file, `${workspace}/package.json`));
  });
  return { ...packageJson, workspaces };
}

export function prunePackageDependencies(
  packageJson: Record<string, unknown>,
  unavailableWorkspaceNames: ReadonlySet<string>,
): Record<string, unknown> {
  let changed = false;
  const updated = { ...packageJson };
  for (const group of [
    'dependencies',
    'devDependencies',
    'optionalDependencies',
    'peerDependencies',
  ]) {
    const dependencies = packageJson[group];
    if (!isRecord(dependencies)) continue;
    const kept = Object.fromEntries(
      Object.entries(dependencies).filter(([name]) => !unavailableWorkspaceNames.has(name)),
    );
    if (Object.keys(kept).length !== Object.keys(dependencies).length) {
      updated[group] = kept;
      changed = true;
    }
  }
  return changed ? updated : packageJson;
}

/** Applies the typed transform to a generated root package.json. */
export async function pruneRootPackage(
  root: string,
  deletedFiles: readonly string[],
): Promise<boolean> {
  const path = join(root, ROOT_PACKAGE_JSON);
  const raw = await readFileIfExists(path);
  if (raw === undefined) return false;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Could not parse ${ROOT_PACKAGE_JSON}: ${reason}`);
  }
  if (!isRecord(parsed)) return false;

  const existingFiles = await listFiles(root);
  const unavailableWorkspaceNames = await findUnavailableWorkspaceNames(root, existingFiles);
  const withScripts = prunePackageScripts(parsed, deletedFiles);
  const withWorkspaces = prunePackageWorkspaces(withScripts, existingFiles);
  const updated = prunePackageDependencies(withWorkspaces, unavailableWorkspaceNames);
  let changed = JSON.stringify(updated) !== JSON.stringify(parsed);
  if (changed) await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');

  for (const file of existingFiles.filter((entry) => entry.endsWith('/package.json'))) {
    const nestedPath = join(root, file);
    const nestedRaw = await readFileIfExists(nestedPath);
    if (nestedRaw === undefined) continue;
    const nested: unknown = JSON.parse(nestedRaw);
    if (!isRecord(nested)) continue;
    const pruned = prunePackageDependencies(nested, unavailableWorkspaceNames);
    if (pruned === nested) continue;
    await writeFile(nestedPath, `${JSON.stringify(pruned, null, 2)}\n`, 'utf8');
    changed = true;
  }
  return changed;
}

async function findUnavailableWorkspaceNames(
  root: string,
  files: readonly string[],
): Promise<Set<string>> {
  const raw = await readFileIfExists(join(root, ROOT_PACKAGE_LOCK));
  if (raw === undefined) return new Set();
  const lock: unknown = JSON.parse(raw);
  if (!isRecord(lock) || !isRecord(lock.packages)) return new Set();
  const names = new Set<string>();
  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!path || path.startsWith('node_modules/') || !isRecord(entry)) continue;
    if (typeof entry.resolved === 'string' || files.includes(`${path}/package.json`)) continue;
    if (typeof entry.name === 'string') names.add(entry.name);
  }
  return names;
}
