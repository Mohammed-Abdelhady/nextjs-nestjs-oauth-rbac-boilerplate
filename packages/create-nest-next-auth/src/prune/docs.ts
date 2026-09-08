import { readFile, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { listFiles } from '../utils/fs.js';

const LIST_OR_ROW = new RegExp('^\\s*([-*+]|\\|)');
const LINK = '](';

export interface DocPruneResult {
  removedLines: number;
  editedFiles: string[];
}

function linksToRemovedDoc(line: string, names: string[]): boolean {
  if (!line.includes(LINK)) return false;
  return names.some((name) => line.includes(name));
}

/**
 * Drops list items and table rows that link to a doc which no longer exists.
 * Prose mentions are left alone; they need a human edit, not a line delete.
 */
export async function removeDocLinks(root: string, docPaths: string[]): Promise<DocPruneResult> {
  if (docPaths.length === 0) return { removedLines: 0, editedFiles: [] };

  const names = docPaths.map((path) => basename(path));
  const markdown = (await listFiles(root)).filter((file) => file.endsWith('.md'));
  const editedFiles: string[] = [];
  let removedLines = 0;

  for (const file of markdown) {
    const path = join(root, file);
    const lines = (await readFile(path, 'utf8')).split('\n');
    const kept = lines.filter(
      (line) => !(LIST_OR_ROW.test(line) && linksToRemovedDoc(line, names)),
    );
    if (kept.length === lines.length) continue;

    removedLines += lines.length - kept.length;
    editedFiles.push(file);
    await writeFile(path, kept.join('\n'), 'utf8');
  }

  return { removedLines, editedFiles };
}
