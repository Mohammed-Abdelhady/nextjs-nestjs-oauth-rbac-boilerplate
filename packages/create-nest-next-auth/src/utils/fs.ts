import { readdir, rm, rmdir } from 'node:fs/promises';
import { dirname, join, posix, relative, sep } from 'node:path';
import { SKIPPED_DIRS } from '../constants/index.js';

/** Lists every file under `root` as a posix path relative to `root`. */
export async function listFiles(root: string): Promise<string[]> {
  const found: string[] = [];

  async function walk(directory: string): Promise<void> {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        await walk(full);
        continue;
      }
      if (entry.isFile()) found.push(toPosix(relative(root, full)));
    }
  }

  await walk(root);
  return found.sort();
}

export function toPosix(path: string): string {
  return path.split(sep).join(posix.sep);
}

/** Removes a file and any directories it leaves empty, stopping at `root`. */
export async function removeFile(root: string, relativePath: string): Promise<void> {
  const target = join(root, relativePath);
  await rm(target, { force: true });

  let directory = dirname(target);
  while (directory.startsWith(root) && directory !== root) {
    try {
      await rmdir(directory);
    } catch {
      return;
    }
    directory = dirname(directory);
  }
}
