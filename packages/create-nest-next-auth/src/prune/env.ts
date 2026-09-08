import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  CLI_NAME,
  ENV_EXAMPLE_FILES,
  FEATURE_FLAG_VAR,
  MANIFEST_FILE,
} from '../constants/index.js';

const ASSIGNMENT = new RegExp('^\\s*#?\\s*([A-Za-z_][A-Za-z0-9_]*)\\s*=');
const COMMENT = new RegExp('^\\s*#');

/** Env var name mapped to the words that identify its feature in a comment. */
export type EnvRemovals = Map<string, string[]>;

export interface EnvStripResult {
  content: string;
  stripped: string[];
}

function readKey(line: string): string | undefined {
  const match = ASSIGNMENT.exec(line);
  return match?.[1];
}

function namesFeature(comment: string, words: string[]): boolean {
  const lowered = comment.toLowerCase();
  return words.some((word) => word.length > 0 && lowered.includes(word.toLowerCase()));
}

function collapseBlankRuns(lines: string[]): string[] {
  const output: string[] = [];
  for (const line of lines) {
    const isBlank = line.trim().length === 0;
    const previousBlank = output.length > 0 && output[output.length - 1].trim().length === 0;
    if (isBlank && (previousBlank || output.length === 0)) continue;
    output.push(line);
  }
  while (output.length > 0 && output[output.length - 1].trim().length === 0) output.pop();
  return output;
}

/**
 * Drops every line assigning one of the removed vars, commented out or not,
 * along with the comment directly above it when that comment names the feature.
 */
export function stripEnvVars(content: string, removals: EnvRemovals): EnvStripResult {
  const stripped: string[] = [];
  const kept: string[] = [];

  for (const line of content.split('\n')) {
    const key = readKey(line);
    const words = key === undefined ? undefined : removals.get(key);
    if (key === undefined || words === undefined) {
      kept.push(line);
      continue;
    }

    stripped.push(key);
    const previous = kept[kept.length - 1];
    if (previous !== undefined && COMMENT.test(previous) && readKey(previous) === undefined) {
      if (namesFeature(previous, words)) kept.pop();
    }
  }

  return { content: `${collapseBlankRuns(kept).join('\n')}\n`, stripped };
}

/** Applies stripEnvVars to the generated env examples that exist. */
export async function stripEnvFiles(root: string, removals: EnvRemovals): Promise<string[]> {
  const stripped = new Set<string>();

  for (const relative of ENV_EXAMPLE_FILES) {
    const path = join(root, relative);
    let content: string;
    try {
      content = await readFile(path, 'utf8');
    } catch {
      continue;
    }
    const result = stripEnvVars(content, removals);
    if (result.stripped.length === 0) continue;
    await writeFile(path, result.content, 'utf8');
    for (const key of result.stripped) stripped.add(key);
  }

  return [...stripped].sort();
}

/** Records the enabled feature ids in the generated backend env example. */
export async function writeFeatureFlag(root: string, selected: string[]): Promise<void> {
  const path = join(root, 'backend/.env.example');
  let content: string;
  try {
    content = await readFile(path, 'utf8');
  } catch {
    return;
  }

  const block = [
    '',
    '# Authentication methods enabled in this project.',
    `# Written by ${CLI_NAME} from ${MANIFEST_FILE}.`,
    `${FEATURE_FLAG_VAR}=${selected.join(',')}`,
    '',
  ].join('\n');

  const withoutOld = content
    .split('\n')
    .filter((line) => !line.startsWith(`${FEATURE_FLAG_VAR}=`))
    .join('\n')
    .replace(/\n+$/, '\n');

  await writeFile(path, `${withoutOld}${block}`, 'utf8');
}
