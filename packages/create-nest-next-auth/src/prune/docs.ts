import { readFile, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { listFiles, toPosix } from '../utils/fs.js';

const LIST_OR_ROW = /^\s*(?:[-*+]|\d+[.)]|\|)/;
const INLINE_LINK = /\[([^\]]*)\]\((<[^>]+>|[^)\s]+)(?:\s+[^)]*)?\)/g;
const REFERENCE = /^\s{0,3}\[([^\]]+)\]:\s*(<[^>]+>|[^\s]+)/;
const REFERENCE_LINK = /\[([^\]]+)\](?:\[([^\]]*)\])?/g;

export interface DocPruneResult {
  removedLines: number;
  editedFiles: string[];
}

function targetPath(target: string): string | undefined {
  const unwrapped = target.startsWith('<') && target.endsWith('>') ? target.slice(1, -1) : target;
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/|\/)/i.test(unwrapped)) return undefined;
  const path = unwrapped.split(/[?#]/, 1)[0];
  return path === '' ? undefined : path;
}

function isRemovedTarget(file: string, target: string, removed: Set<string>): boolean {
  const path = targetPath(target);
  if (path === undefined) return false;
  return removed.has(posix.normalize(posix.join(posix.dirname(file), path)));
}

function referenceTargets(lines: string[]): Map<string, string> {
  const targets = new Map<string, string>();
  for (const line of lines) {
    const definition = REFERENCE.exec(line);
    if (definition !== null) targets.set(definition[1].trim().toLowerCase(), definition[2]);
  }
  return targets;
}

function pruneListLine(
  file: string,
  line: string,
  references: Map<string, string>,
  removed: Set<string>,
): string | undefined {
  if (!LIST_OR_ROW.test(line)) return line;
  let foundRemoved = false;
  let survivingLinks = 0;
  const inline = line.replace(INLINE_LINK, (match, label: string, target: string) => {
    if (isRemovedTarget(file, target, removed)) {
      foundRemoved = true;
      return label;
    }
    survivingLinks += 1;
    return match;
  });
  const referenced = inline.replace(
    REFERENCE_LINK,
    (match, label: string, id: string | undefined, offset: number, source: string) => {
      if (source[offset + match.length] === '(') return match;
      const key = (id || label).trim().toLowerCase();
      const target = references.get(key);
      if (target === undefined) return match;
      if (isRemovedTarget(file, target, removed)) {
        foundRemoved = true;
        return label;
      }
      survivingLinks += 1;
      return match;
    },
  );
  if (!foundRemoved) return line;
  return survivingLinks === 0 ? undefined : referenced;
}

/** Removes dead links from list items and rows while preserving links that survive. */
export async function removeDocLinks(root: string, docPaths: string[]): Promise<DocPruneResult> {
  if (docPaths.length === 0) return { removedLines: 0, editedFiles: [] };

  const removed = new Set(docPaths.map((path) => posix.normalize(toPosix(path))));
  const markdown = (await listFiles(root)).filter((file) => file.endsWith('.md'));
  const editedFiles: string[] = [];
  let removedLines = 0;

  for (const file of markdown) {
    const path = join(root, file);
    const original = (await readFile(path, 'utf8')).split('\n');
    const references = referenceTargets(original);
    const kept: string[] = [];
    for (const line of original) {
      const definition = REFERENCE.exec(line);
      if (definition !== null && isRemovedTarget(file, definition[2], removed)) {
        removedLines += 1;
        continue;
      }
      const result = pruneListLine(file, line, references, removed);
      if (result === undefined) {
        removedLines += 1;
        continue;
      }
      kept.push(result);
    }
    if (kept.length === original.length && kept.every((line, index) => line === original[index]))
      continue;
    editedFiles.push(file);
    await writeFile(path, kept.join('\n'), 'utf8');
  }

  return { removedLines, editedFiles };
}
