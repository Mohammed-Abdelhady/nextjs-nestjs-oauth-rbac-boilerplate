import { readFile } from 'node:fs/promises';
import { extname, join, posix } from 'node:path';
import { SOURCE_EXTENSIONS } from '../constants/index.js';
import type { DanglingReference } from '../types.js';
import { listFiles } from '../utils/fs.js';

// from '...' | import('...') | require('...')
const SPECIFIER = new RegExp(
  ['(?:from|import|require)', '\\s*\\(?\\s*', '[\'"]', '([^\'"]+)', '[\'"]'].join(''),
  'g',
);

function isSourceFile(path: string): boolean {
  return (SOURCE_EXTENSIONS as readonly string[]).includes(extname(path));
}

/** Strips .ts and friends. Leaves other dots alone, as in google-oauth.strategy. */
function withoutExtension(path: string): string {
  const extension = extname(path);
  const isSource = (SOURCE_EXTENSIONS as readonly string[]).includes(extension);
  return isSource ? path.slice(0, -extension.length) : path;
}

function resolveSpecifier(importer: string, specifier: string): string | undefined {
  if (!specifier.startsWith('.')) return undefined;
  return withoutExtension(posix.normalize(posix.join(posix.dirname(importer), specifier)));
}

/**
 * Reports imports that point at files the pruner deleted. A non-empty result
 * means the manifest claims a file belongs to one feature while shared code
 * still depends on it.
 */
export async function findDanglingReferences(
  root: string,
  deletedFiles: string[],
): Promise<DanglingReference[]> {
  const deletedSources = deletedFiles.filter(isSourceFile).map(withoutExtension);
  if (deletedSources.length === 0) return [];

  const byPath = new Map(deletedSources.map((path) => [path, path]));
  for (const path of deletedSources) {
    // An index file is imported through its directory.
    if (path.endsWith('/index')) byPath.set(path.slice(0, -'/index'.length), path);
  }
  const bySuffix = deletedSources.map((path) => ({ path, suffix: `/${path.split('/').pop()}` }));
  const dangling: DanglingReference[] = [];

  for (const file of (await listFiles(root)).filter(isSourceFile)) {
    const lines = (await readFile(join(root, file), 'utf8')).split('\n');

    lines.forEach((line, index) => {
      for (const match of line.matchAll(SPECIFIER)) {
        const specifier = match[1];
        const target = matchDeleted(file, specifier, byPath, bySuffix);
        if (target === undefined) continue;
        dangling.push({ file, line: index + 1, specifier, target });
      }
    });
  }

  return dangling;
}

function matchDeleted(
  importer: string,
  specifier: string,
  byPath: Map<string, string>,
  bySuffix: { path: string; suffix: string }[],
): string | undefined {
  const resolved = resolveSpecifier(importer, specifier);
  if (resolved !== undefined) return byPath.get(resolved);

  // Alias imports such as @/auth/strategies/google-oauth.strategy or src/... .
  const normalized = withoutExtension(specifier);
  const hit = bySuffix.find(({ suffix }) => normalized.endsWith(suffix));
  return hit?.path;
}
