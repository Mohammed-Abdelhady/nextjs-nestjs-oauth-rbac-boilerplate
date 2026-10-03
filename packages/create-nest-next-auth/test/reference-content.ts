import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface ContentException {
  path: string;
  reason: string;
}

/**
 * Files allowed to keep a forbidden word with an option off. Kept as short as
 * possible; each entry needs a reason.
 */
export const CONTENT_EXCEPTIONS: readonly ContentException[] = [];

/** Directories skipped when scanning generated content. */
export const SKIPPED_SCAN_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'coverage',
  'out',
]);

/** Lockfiles skipped when scanning generated content. */
export const SKIPPED_SCAN_FILES = new Set(['package-lock.json']);

/** Files, relative to `root`, that contain one of `patterns`. */
export function findForbiddenContent(root: string, patterns: readonly RegExp[]): string[] {
  const excepted = new Set(CONTENT_EXCEPTIONS.map((entry) => entry.path));
  const hits: string[] = [];

  const walk = (directory: string): void => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_SCAN_DIRS.has(entry.name)) continue;
        walk(full);
        continue;
      }
      if (!entry.isFile() || SKIPPED_SCAN_FILES.has(entry.name)) continue;

      const path = relative(root, full).split('\\').join('/');
      if (excepted.has(path)) continue;

      const content = readFileSync(full, 'utf8');
      // A NUL byte means binary (a favicon), which is not text to match.
      if (content.includes('\u0000')) continue;
      if (patterns.some((pattern) => pattern.test(content))) hits.push(path);
    }
  };

  walk(root);
  return hits.sort();
}

/** Words no file should carry in a project generated with docker off. */
export const DOCKER_FORBIDDEN = [
  /\bdocker\b/i,
  /\bcompose\b/i,
  /\bnginx\b/i,
  /setup:prod/,
  /verify-docker/,
  /deployment\.md/,
];

/** Words no file should carry in a project generated with production off. */
export const PRODUCTION_FORBIDDEN = [/\bnginx\b/i, /docker-compose\.prod/];

/** Arabic content no file should carry in a project generated with Arabic off. */
export const ARABIC_FORBIDDEN = [
  /'ar'/,
  /"ar"/,
  /\/ar\//,
  /\bar\b/,
  /ar\.json/,
  /\bArabic\b/i,
  /switchToArabic/,
  /[\u0600-\u06FF]/,
];
