import { readFile, writeFile } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { MARKER_EXTENSIONS } from '../constants/index.js';
import { listFiles } from '../utils/fs.js';

// `// feature:a,b`, `// feature:a:start`, `{/* feature:a:end */}`, at line end.
const MARKER = new RegExp(
  [
    '\\s*(?:',
    '\\/\\/\\s*feature:([^\\r\\n]*?)',
    '|',
    '\\{\\/\\*\\s*feature:([^\\r\\n]*?)\\s*\\*\\/\\}',
    ')\\s*$',
  ].join(''),
);

const TOKEN = /^[a-z0-9][a-z0-9-]*(?:,[a-z0-9][a-z0-9-]*)*(?::(?:start|end))?$/;

type MarkerKind = 'line' | 'start' | 'end';

interface Marker {
  ids: string[];
  kind: MarkerKind;
  /** Where the marker starts, including the whitespace in front of it. */
  at: number;
}

export interface MarkerResult {
  editedFiles: string[];
  removedLines: number;
}

export class MarkerError extends Error {
  constructor(file: string, line: number, problem: string) {
    super(`${file}:${line} ${problem}`);
    this.name = 'MarkerError';
  }
}

function parseMarker(
  line: string,
  file: string,
  number: number,
  known: Set<string>,
): Marker | undefined {
  const match = MARKER.exec(line);
  if (match === null) return undefined;

  const token = (match[1] ?? match[2]).trim();
  if (!TOKEN.test(token)) {
    throw new MarkerError(file, number, `has a malformed feature marker: ${token}`);
  }

  const [list, suffix] = token.split(':');
  const ids = list.split(',');
  for (const id of ids) {
    if (!known.has(id)) {
      throw new MarkerError(
        file,
        number,
        `marks feature "${id}", which the manifest does not list`,
      );
    }
  }

  const kind: MarkerKind = suffix === 'start' || suffix === 'end' ? suffix : 'line';
  if (kind !== 'line' && line.slice(0, match.index).trim().length > 0) {
    throw new MarkerError(file, number, `puts a ${kind} marker on a line that also carries code`);
  }

  return { ids, kind, at: match.index };
}

interface Frame {
  ids: string[];
  keep: boolean;
  opened: number;
}

/**
 * Deletes the lines and blocks marked for features that were not selected, and
 * takes the marker comments off the lines that stay.
 *
 * @throws MarkerError on an unknown feature id, a malformed marker, or a block
 * that is never closed
 */
export function stripFeatureMarkers(
  content: string,
  file: string,
  kept: Set<string>,
  known: Set<string>,
): { content: string; removedLines: number } {
  const lines = content.split('\n');
  const output: string[] = [];
  const stack: Frame[] = [];
  let droppedBlocks = 0;

  lines.forEach((line, index) => {
    const number = index + 1;
    const marker = parseMarker(line, file, number, known);
    const dropping = droppedBlocks > 0;

    if (marker === undefined) {
      if (!dropping) output.push(line);
      return;
    }

    if (marker.kind === 'start') {
      const keep = marker.ids.some((id) => kept.has(id));
      stack.push({ ids: marker.ids, keep, opened: number });
      if (!keep) droppedBlocks += 1;
      return;
    }

    if (marker.kind === 'end') {
      const frame = stack.pop();
      if (frame === undefined)
        throw new MarkerError(file, number, 'closes a block that never opened');
      if (!frame.keep) droppedBlocks -= 1;
      if (frame.ids.join(',') !== marker.ids.join(',')) {
        throw new MarkerError(
          file,
          number,
          `closes ${marker.ids.join(',')} while ${frame.ids.join(',')} is open from line ${frame.opened}`,
        );
      }
      return;
    }

    if (dropping) return;
    if (!marker.ids.some((id) => kept.has(id))) return;

    const stripped = line.slice(0, marker.at);
    if (stripped.trim().length > 0) output.push(stripped + (line.endsWith('\r') ? '\r' : ''));
  });

  const unclosed = stack[stack.length - 1];
  if (unclosed !== undefined) {
    throw new MarkerError(
      file,
      unclosed.opened,
      `opens ${unclosed.ids.join(',')} and never closes it`,
    );
  }

  return { content: output.join('\n'), removedLines: lines.length - output.length };
}

/**
 * Applies stripFeatureMarkers to every source file under `root`. Files with no
 * marker are left untouched, so the result differs from the template only where
 * a marker sat.
 */
export async function removeFeatureLines(
  root: string,
  selected: string[],
  known: string[],
): Promise<MarkerResult> {
  const kept = new Set(selected);
  const ids = new Set(known);
  const editedFiles: string[] = [];
  let removedLines = 0;

  const files = (await listFiles(root)).filter((file) =>
    (MARKER_EXTENSIONS as readonly string[]).includes(extname(file)),
  );

  for (const file of files) {
    const path = join(root, file);
    const content = await readFile(path, 'utf8');
    if (!content.includes('feature:')) continue;

    const result = stripFeatureMarkers(content, file, kept, ids);
    if (result.content === content) continue;

    editedFiles.push(file);
    removedLines += result.removedLines;
    await writeFile(path, result.content, 'utf8');
  }

  return { editedFiles, removedLines };
}
