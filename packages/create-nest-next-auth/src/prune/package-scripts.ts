import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ROOT_PACKAGE_JSON } from '../constants/index.js';
import TEMPLATE_TEST_POLICY from '../constants/template-tests.json' with { type: 'json' };
import { isRecord } from '../manifest/read.js';
import { readFileIfExists } from '../utils/fs.js';

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

  const updated = prunePackageScripts(parsed, deletedFiles);
  if (JSON.stringify(updated) === JSON.stringify(parsed)) return false;

  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return true;
}
