import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isMap, isSeq, parseDocument } from 'yaml';
import { readFileIfExists } from '../utils/fs.js';

/** Dependabot config whose docker entries follow the files they track. */
export const DEPENDABOT_FILE = '.github/dependabot.yml';

function entryUsesDeletedDockerfile(entry: unknown, deleted: Set<string>): boolean {
  if (!isMap(entry)) return false;
  const plain = entry.toJSON() as Record<string, unknown>;
  if (plain['package-ecosystem'] !== 'docker') return false;
  if (typeof plain.directory !== 'string') return false;
  const directory = plain.directory.replace(/^\/+/, '').replace(/\/+$/, '');
  const dockerfile = directory === '' ? 'Dockerfile' : `${directory}/Dockerfile`;
  return deleted.has(dockerfile);
}

/**
 * Drops a docker update entry whose directory no longer has a Dockerfile. It
 * edits the parsed document in place, so untouched text, quotes and blank lines
 * are preserved. Returns false when nothing changed.
 */
export async function pruneDependabot(
  root: string,
  deletedFiles: readonly string[],
): Promise<boolean> {
  const path = join(root, DEPENDABOT_FILE);
  const raw = await readFileIfExists(path);
  if (raw === undefined) return false;

  const document = parseDocument(raw);
  if (document.errors.length > 0) {
    throw new Error(`Could not parse ${DEPENDABOT_FILE}: ${document.errors[0].message}`);
  }
  const updates = document.get('updates');
  if (!isSeq(updates)) return false;

  const deleted = new Set(deletedFiles);
  const kept = updates.items.filter((entry) => !entryUsesDeletedDockerfile(entry, deleted));
  if (kept.length === updates.items.length) return false;

  updates.items = kept;
  await writeFile(path, document.toString(), 'utf8');
  return true;
}
