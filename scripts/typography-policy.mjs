import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export const TYPOGRAPHY_SOURCE_ROOT = 'frontend/src';
export const VIOLATION_KINDS = { HAND_WRITTEN: 'hand-written', RAW_HEADING: 'raw-heading' };

const SOURCE_EXTENSION = '.tsx';
const SKIPPED_DIRECTORIES = ['node_modules', '.next'];
const RAW_HEADING = /^h[1-6]$/;
// Components that already carry a role, so a size or weight on top is an override.
const ROLE_COMPONENTS = [
  'Heading',
  'Description',
  'CardTitle',
  'CardDescription',
  'DialogTitle',
  'DialogDescription',
  'AlertDialogTitle',
  'AlertDialogDescription',
  'SheetTitle',
  'SheetDescription',
  'AlertTitle',
];
// The primitives that define the roles are the only place a heading element is written out.
const RAW_HEADING_HOMES = ['components/design-system/', 'components/ui/'];
const SCREEN_READER_ONLY = /(?<![\w-])sr-only(?![\w-])/;
const ELEMENT_START = /<([A-Za-z][\w.]*)(?=[\s/>])/g;
const HAND_WRITTEN_CLASS =
  /(?<![\w-])(?:[\w-]+:)*(?:text-(?:xs|sm|base|lg|xl|\dxl)|text-\[[^\]]+\]|font-(?:\[\d+(?:\.\d+)?\]|thin|extralight|light|normal|medium|semibold|bold|extrabold|black))(?![\w-])/g;
const COMMENT = /\/\*[\s\S]*?\*\/|(?<!:)\/\/.*$/gm;
const QUOTES = ['"', "'", '`'];

const blank = (text) => text.replace(/[^\n]/g, ' ');

// Returns the index just past the `>` that closes the opening tag starting at `start`.
function openingTagEnd(source, start) {
  let depth = 0;
  let quote = null;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (QUOTES.includes(character)) quote = character;
    else if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    else if (character === '>' && depth === 0) return index + 1;
  }
  return source.length;
}

export function typographyViolations(source, file) {
  const text = source.replace(COMMENT, blank);
  const path = file.split(sep).join('/');
  const violations = [];

  for (const match of text.matchAll(ELEMENT_START)) {
    const element = match[1];
    const raw = RAW_HEADING.test(element);
    if (!raw && !ROLE_COMPONENTS.includes(element)) continue;

    const tag = text.slice(match.index, openingTagEnd(text, match.index));
    const line = text.slice(0, match.index).split('\n').length;
    const report = (kind, token) => violations.push({ file: path, line, element, kind, token });

    for (const [token] of tag.matchAll(HAND_WRITTEN_CLASS)) {
      report(VIOLATION_KINDS.HAND_WRITTEN, token);
    }
    if (
      raw &&
      !RAW_HEADING_HOMES.some((home) => path.includes(home)) &&
      !SCREEN_READER_ONLY.test(tag)
    ) {
      report(VIOLATION_KINDS.RAW_HEADING, element);
    }
  }

  return violations;
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED_DIRECTORIES.includes(entry.name) ? [] : sourceFiles(path);
    }
    return entry.name.endsWith(SOURCE_EXTENSION) ? [path] : [];
  });
}

export function scanTypography(root, sourceRoot = TYPOGRAPHY_SOURCE_ROOT) {
  const directory = join(root, sourceRoot);
  if (!existsSync(directory)) return [];

  return sourceFiles(directory)
    .sort()
    .flatMap((path) => typographyViolations(readFileSync(path, 'utf8'), relative(root, path)));
}
