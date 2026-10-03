import path from 'node:path';
import {
  ATTRIBUTION_PATTERNS,
  BANNED_CONSTRUCTS,
  CAPPED_FILES,
  CAPPED_PATH,
  DOM_TOKENS,
  EXEMPT_PATHS,
  FILE_LINE_LIMIT,
  LINE_ENDINGS,
  PROTECTED_FILE_PATTERN,
  BINARY_EXTENSIONS,
  BINARY_PROBE_BYTES,
  MAX_EXCERPT_LENGTH,
  UNCAPPED_EXTENSIONS,
  PROTECTED_EXTENSION,
  SCAN_EXTENSIONS,
  SKIPPED_DIRECTORY_PARTS,
  SKIPPED_PATH_PREFIXES,
} from './policy.mjs';

export { FILE_LINE_LIMIT } from './policy.mjs';
export const HARD_BAN_TOKENS = BANNED_CONSTRUCTS.map((rule) => rule.token);
const TOKEN_PATTERNS = BANNED_CONSTRUCTS.map(({ token, pattern, followingCast }) => {
  if (pattern) return { token, pattern, followingCast };
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = /^\w/.test(token) ? '\\b' : '';
  const suffix = /\w$/.test(token) && !token.startsWith('@ts-') ? '\\b' : '';
  return { token, pattern: new RegExp(`${prefix}${escaped}${suffix}`, 'g') };
});
const DENIAL_LINE = /^expect\((.*)\)\.not\.(?:toContain|toMatch)\(\s*(['"])([^'"]+)\2\s*\);?$/;

export function countLines(text) {
  if (text.length === 0) return 0;
  const lines = text.split(LINE_ENDINGS);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

export function isProtectedPath(filePath) {
  const normalized = filePath;
  if (SCAN_EXTENSIONS.includes(path.posix.extname(normalized).toLowerCase())) return false;
  const name = path.posix.basename(normalized);
  return (
    ((name === '.env' || name.startsWith('.env.')) && !name.endsWith('.example')) ||
    PROTECTED_EXTENSION.test(normalized) ||
    PROTECTED_FILE_PATTERN.test(normalized)
  );
}

export function isContentTarget(filePath) {
  if (isProtectedPath(filePath)) return false;
  if (isScanTarget(filePath)) return true;
  return (
    isCappedPath(filePath) &&
    !BINARY_EXTENSIONS.includes(path.posix.extname(filePath).toLowerCase())
  );
}

export function isTextContent(filePath, content) {
  return isScanTarget(filePath) || !content.subarray(0, BINARY_PROBE_BYTES).includes(0);
}

export function isScanTarget(filePath) {
  const normalized = filePath;
  if (isProtectedPath(normalized)) return false;
  if (normalized === 'package.json' || normalized.endsWith('/package.json')) return true;
  if (normalized.startsWith('.husky/') && !normalized.includes('/_/')) return true;
  if (SKIPPED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (normalized.split('/').some((part) => SKIPPED_DIRECTORY_PARTS.includes(part))) return false;
  return SCAN_EXTENSIONS.includes(path.posix.extname(normalized).toLowerCase());
}

export function isAllowlistedChecker(filePath) {
  return EXEMPT_PATHS.includes(filePath);
}

export function isCappedPath(filePath) {
  if (UNCAPPED_EXTENSIONS.includes(path.posix.extname(filePath).toLowerCase())) return false;
  if (!isScanTarget(filePath)) {
    if (SKIPPED_PATH_PREFIXES.some((prefix) => filePath.startsWith(prefix))) return false;
    if (filePath.split('/').some((part) => SKIPPED_DIRECTORY_PARTS.includes(part))) return false;
  }
  return CAPPED_PATH.test(filePath) || CAPPED_FILES.includes(filePath);
}

export function isTestFile(filePath) {
  return /(?:\.|-)(spec|test)\./.test(path.posix.basename(filePath));
}

function hasBalancedReceiver(receiver) {
  let depth = 0;
  let quote;
  for (let index = 0; index < receiver.length; index += 1) {
    const character = receiver[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = undefined;
      continue;
    }
    if (character === '/' || character === ';' || character === '`') return false;
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (character === '(') depth += 1;
    if (character === ')' && --depth < 0) return false;
  }
  return !quote && depth === 0;
}

function separatorEndpoints(text) {
  const endpoints = new Uint32Array(text.length + 1);
  endpoints[text.length] = text.length;
  let commentClose = -1;
  let laterClose = -1;
  for (let index = text.length - 1; index >= 0; index -= 1) {
    if (text[index] === '*' && text[index + 1] === '/') {
      laterClose = commentClose;
      commentClose = index;
    }
    const close = commentClose === index + 1 ? laterClose : commentClose;
    if (/\s/.test(text[index])) endpoints[index] = endpoints[index + 1];
    else if (text[index] === '/' && text[index + 1] === '*' && close >= index + 2)
      endpoints[index] = endpoints[close + 2];
    else endpoints[index] = index;
  }
  return endpoints;
}

function findBannedMatch(text, { testFile = false } = {}) {
  let endpoints;
  const hits = TOKEN_PATTERNS.flatMap(({ token, pattern, followingCast }) =>
    [...text.matchAll(pattern)]
      .filter((match) => {
        if (!followingCast || match[2]) return true;
        endpoints ??= separatorEndpoints(text);
        const start = match.index + match[0].length;
        const end = endpoints[start];
        if (end > start && /^as\b/.test(text.slice(end, end + 3))) return true;
        if (!match[1] || text[end] !== ')') return false;
        const next = endpoints[end + 1];
        return /^as\b/.test(text.slice(next, next + 3));
      })
      .map((match) => ({
        token,
        index: match.index + (match[1] ? match[0].search(/\bas\s+unknown\b/) : 0),
      })),
  );
  if (testFile && hits.length === 1) {
    const match = text.trim().match(DENIAL_LINE);
    if (
      match &&
      hasBalancedReceiver(match[1]) &&
      DOM_TOKENS.includes(match[3]) &&
      hits[0].token === match[3]
    )
      return null;
  }
  return hits[0] ?? null;
}

export function findBannedToken(text, options) {
  return findBannedMatch(text, options)?.token ?? null;
}

function excerpt(text, index) {
  const trimmed = text.trim();
  const offset = index - (text.length - text.trimStart().length);
  const start = Math.max(
    0,
    Math.min(offset - Math.floor(MAX_EXCERPT_LENGTH / 2), trimmed.length - MAX_EXCERPT_LENGTH),
  );
  return trimmed.slice(start, start + MAX_EXCERPT_LENGTH);
}

export function parseUnifiedDiff(diffText, filePath) {
  const files = [];
  let current = null;
  let newLine = 0;
  let inHunk = false;
  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('diff --git ')) {
      current = null;
      inHunk = false;
      continue;
    }
    if (!inHunk && raw.startsWith('+++ ')) {
      let nextPath = filePath ?? raw.slice(4);
      if (!filePath && nextPath.startsWith('"')) nextPath = JSON.parse(nextPath);
      nextPath = nextPath.replace(/^b\//, '').replace(/\t$/, '');
      current = nextPath === '/dev/null' ? null : { path: filePath ?? nextPath, addedLines: [] };
      if (current) files.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('@@')) {
      inHunk = true;
      const match = raw.match(/\+(\d+)/);
      newLine = match ? Number.parseInt(match[1], 10) : 0;
    } else if (raw.startsWith('+')) {
      current.addedLines.push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
    } else if (!raw.startsWith('-') && !raw.startsWith('\\')) newLine += 1;
  }
  return files;
}

export function evaluateChanges({ added, lineCounts }) {
  const bans = [];
  const caps = [];
  for (const file of added) {
    if (!isScanTarget(file.path) || isAllowlistedChecker(file.path)) continue;
    for (const { line, text } of file.addedLines) {
      const hit = findBannedMatch(text, { testFile: isTestFile(file.path) });
      if (hit)
        bans.push({ path: file.path, line, token: hit.token, text: excerpt(text, hit.index) });
    }
  }
  for (const { path: filePath, lines } of lineCounts) {
    if (isCappedPath(filePath) && lines > FILE_LINE_LIMIT) caps.push({ path: filePath, lines });
  }
  return { bans, caps, ok: bans.length === 0 && caps.length === 0 };
}

export function findAttributionHits(message) {
  return ATTRIBUTION_PATTERNS.filter((pattern) => pattern.test(message)).map(
    (pattern) => pattern.source,
  );
}

export function stripAttribution(message) {
  const kept = message.split('\n').filter((line) => findAttributionHits(line).length === 0);
  while (kept.length > 0 && kept[kept.length - 1] === '') kept.pop();
  return `${kept.join('\n')}\n`;
}
