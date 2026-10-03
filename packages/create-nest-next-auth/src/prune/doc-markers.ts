import { listFiles } from '../utils/fs.js';
import {
  type MarkerFileResult,
  type ParsedMarker,
  readMarkerToken,
  stripMarkedFiles,
  stripWithMarkers,
  type Stripper,
} from './strip-markers.js';

// `<!-- feature:docker -->`, `<!-- feature:docker:start -->`, at line end.
const DOC_MARKER = /\s*<!--\s*feature:([^\r\n>]*?)\s*-->\s*$/;

// Any marker-looking text, so a malformed or trailing marker fails loudly.
const MARKER_TEXT = /<!--\s*feature:/;

export interface DocMarkerResult {
  editedFiles: string[];
  removedLines: number;
}

export class DocMarkerError extends Error {
  constructor(file: string, line: number, problem: string) {
    super(`${file}:${line} ${problem}`);
    this.name = 'DocMarkerError';
  }
}

function parseMarker(
  line: string,
  file: string,
  number: number,
  known: Set<string>,
): ParsedMarker | undefined {
  const match = DOC_MARKER.exec(line);
  if (match === null) return undefined;

  const token = match[1].trim();
  const { ids, kind } = readMarkerToken(
    token,
    file,
    number,
    known,
    (f, l, p) => new DocMarkerError(f, l, p),
    { id: '', malformed: 'doc' },
  );
  if (kind !== 'line' && line.slice(0, match.index).trim().length > 0) {
    throw new DocMarkerError(file, number, `puts a ${kind} marker on a line with other text`);
  }

  return { ids, kind, at: match.index };
}

const DOC_STRIPPER: Stripper = {
  parse: parseMarker,
  fences: true,
  error: (file, line, problem) => new DocMarkerError(file, line, problem),
  leftover: MARKER_TEXT,
  leftoverProblem: 'has a doc marker that is not alone at the end of its line',
};

/**
 * Removes markdown sections marked for options that were not selected and takes
 * the marker comments off the sections that stay. Mirrors the code marker rules
 * so docs can be pruned with the same selection.
 */
export function stripDocMarkers(
  content: string,
  file: string,
  kept: Set<string>,
  known: Set<string>,
): { content: string; removedLines: number } {
  return stripWithMarkers(content, file, kept, known, DOC_STRIPPER);
}

/** Applies stripDocMarkers to every markdown file under `root`. */
export async function removeDocMarkers(
  root: string,
  selected: string[],
  known: string[],
): Promise<DocMarkerResult> {
  const kept = new Set(selected);
  const ids = new Set(known);
  const files = (await listFiles(root)).filter((file) => file.endsWith('.md'));
  const result: MarkerFileResult = await stripMarkedFiles(root, files, (content, file) =>
    stripDocMarkers(content, file, kept, ids),
  );
  return result;
}
