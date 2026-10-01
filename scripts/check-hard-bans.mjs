import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const FILE_LINE_LIMIT = 350;

const SCAN_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.sh']);

const SKIP_DIR_PARTS = ['/node_modules/', '/dist/', '/.next/', '/.husky/_/', '/.expo/'];

const SKIP_PATH_PREFIXES = ['mobile/expo/ios/', 'mobile/expo/android/'];

const CHECKER_NAMES = new Set(['check-hard-bans.mjs', 'check-hard-bans.test.mjs']);

const CAPPED_PATH =
  /^(backend\/(src|test)|frontend\/(src|e2e)|packages\/[^/]+\/src|shared\/[^/]+\/src|mobile\/[^/]+\/(src|app))\//;

export const HARD_BAN_TOKENS = [
  'dangerouslySetInnerHTML',
  'insertAdjacentHTML',
  'eslint-disable-next-line',
  'eslint-disable-line',
  '@SuppressWarnings',
  'as unknown as',
  'satisfies any',
  'prettier-ignore',
  'deno-lint-ignore',
  'oxlint-disable',
  'stylelint-disable',
  'biome-ignore',
  'eslint-disable',
  'eslint-enable',
  'document.write',
  '--no-typecheck',
  '--no-eslint',
  '--no-verify',
  '@ts-expect-error',
  '@ts-nocheck',
  '@ts-ignore',
  'type: ignore',
  'pylint: disable',
  'ruff: noqa',
  '# noqa',
  'as any',
  'outerHTML',
  'innerHTML',
];

const ATTRIBUTION_PATTERNS = [
  /Co-authored-by:\s*Cursor/i,
  /Co-authored-by:\s*cursoragent/i,
  /Made-with:\s*Cursor/i,
  /cursoragent@cursor\.com/i,
  /Generated with.+(Cursor|Claude|ChatGPT|GPT-|Anthropic|OpenAI|Copilot)/i,
  /Co-Authored-By:.+(Claude|ChatGPT|GPT-|Anthropic|Cursor)/i,
];

function posixPath(filePath) {
  return filePath.replaceAll('\\', '/');
}

export function countLines(text) {
  if (text.length === 0) return 0;
  const lines = text.split(/\r?\n/);
  if (lines[lines.length - 1] === '') lines.pop();
  return lines.length;
}

export function isScanTarget(filePath) {
  const normalized = posixPath(filePath);
  if (normalized === 'package.json' || normalized.endsWith('/package.json')) return true;
  if (normalized.startsWith('.husky/') && !normalized.includes('/_/')) return true;
  if (SKIP_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))) return false;
  if (SKIP_DIR_PARTS.some((part) => normalized.includes(part))) return false;
  if (normalized.endsWith('package-lock.json') || normalized.endsWith('pnpm-lock.yaml')) {
    return false;
  }
  return SCAN_EXTS.has(path.posix.extname(normalized));
}

export function isAllowlistedChecker(filePath) {
  return CHECKER_NAMES.has(path.posix.basename(posixPath(filePath)));
}

export function isCappedPath(filePath) {
  return CAPPED_PATH.test(posixPath(filePath));
}

export function isTestFile(filePath) {
  return /\.(spec|test)\.[^.]+$/.test(posixPath(filePath));
}

export function isDenialAssertion(line) {
  return /\bnot\.(toContain|toMatch)\b/.test(line);
}

const TOKEN_PATTERNS = HARD_BAN_TOKENS.map((token) => {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefix = /^\w/.test(token) ? '\\b' : '';
  const suffix = /\w$/.test(token) ? '\\b' : '';
  return { token, pattern: new RegExp(`${prefix}${escaped}${suffix}`) };
});

export function findBannedToken(line) {
  const hit = TOKEN_PATTERNS.find(({ pattern }) => pattern.test(line));
  return hit?.token ?? null;
}

export function parseUnifiedDiff(diffText) {
  const files = [];
  let current = null;
  let newLine = 0;

  for (const raw of diffText.split('\n')) {
    if (raw.startsWith('+++ ')) {
      const nextPath = raw.slice(4).replace(/^b\//, '');
      current = nextPath === '/dev/null' ? null : { path: nextPath, addedLines: [] };
      if (current) files.push(current);
      continue;
    }
    if (!current) continue;
    if (raw.startsWith('@@')) {
      const match = raw.match(/\+(\d+)/);
      newLine = match ? Number.parseInt(match[1], 10) : 0;
      continue;
    }
    if (raw.startsWith('+')) {
      current.addedLines.push({ line: newLine, text: raw.slice(1) });
      newLine += 1;
      continue;
    }
    if (raw.startsWith('-') || raw.startsWith('\\')) continue;
    newLine += 1;
  }

  return files;
}

export function evaluateChanges({ added, lineCounts }) {
  const bans = [];
  const caps = [];

  for (const file of added) {
    if (!isScanTarget(file.path) || isAllowlistedChecker(file.path)) continue;
    for (const { line, text } of file.addedLines) {
      if (isTestFile(file.path) && isDenialAssertion(text)) continue;
      const token = findBannedToken(text);
      if (token) bans.push({ path: file.path, line, token, text: text.trim() });
    }
  }

  for (const { path: filePath, lines } of lineCounts) {
    if (!isCappedPath(filePath)) continue;
    if (lines > FILE_LINE_LIMIT) caps.push({ path: filePath, lines });
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

function git(args, options = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...options });
}

function gitRefExists(ref) {
  try {
    git(['rev-parse', '--verify', ref], { stdio: ['ignore', 'pipe', 'ignore'] });
    return true;
  } catch {
    return false;
  }
}

export function resolvePushRange() {
  try {
    const upstream = git(['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{u}'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    if (upstream) return `${upstream}...HEAD`;
  } catch {
    // No upstream yet.
  }

  for (const ref of ['origin/master', 'origin/main', 'master', 'main']) {
    if (gitRefExists(ref)) return `${ref}...HEAD`;
  }

  return null;
}

function showBlob(spec) {
  try {
    return git(['show', spec], { stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function lineCountsFor(files, specPrefix) {
  const seen = new Set();
  const counts = [];
  for (const file of files) {
    if (seen.has(file.path) || !isCappedPath(file.path)) continue;
    seen.add(file.path);
    const content = showBlob(`${specPrefix}${file.path}`);
    if (content === null) continue;
    counts.push({ path: file.path, lines: countLines(content) });
  }
  return counts;
}

function printReport(result) {
  for (const hit of result.bans) {
    console.error(`${hit.path}:${hit.line}: banned token "${hit.token}": ${hit.text}`);
  }
  for (const hit of result.caps) {
    console.error(
      `${hit.path}: ${hit.lines} lines (limit ${FILE_LINE_LIMIT}). Split the file by responsibility.`,
    );
  }
}

function checkDiff(diffText, specPrefix) {
  const added = parseUnifiedDiff(diffText);
  const result = evaluateChanges({
    added,
    lineCounts: lineCountsFor(added, specPrefix),
  });
  if (!result.ok) {
    printReport(result);
    process.exitCode = 1;
  }
}

export function main(argv = process.argv.slice(2)) {
  if (argv[0] === '--commit-msg') {
    const filePath = argv[1];
    if (!filePath) {
      console.error('usage: check-hard-bans.mjs --commit-msg <file>');
      process.exitCode = 2;
      return;
    }
    const original = readFileSync(filePath, 'utf8');
    const stripped = stripAttribution(original);
    if (stripped !== original) writeFileSync(filePath, stripped);
    const hits = findAttributionHits(stripped);
    if (hits.length > 0) {
      console.error('Commit message credits an AI tool. Commit as the author only.');
      process.exitCode = 1;
    }
    return;
  }

  if (argv[0] === '--staged') {
    const diff = git(['diff', '--cached', '-U0', '--no-color', '--no-ext-diff']);
    checkDiff(diff, ':');
    return;
  }

  if (argv[0] === '--push') {
    const range = resolvePushRange();
    if (!range) return;
    const diff = git(['diff', range, '-U0', '--no-color', '--no-ext-diff']);
    checkDiff(diff, 'HEAD:');
    return;
  }

  console.error('usage: check-hard-bans.mjs --staged | --push | --commit-msg <file>');
  process.exitCode = 2;
}

const invokedDirectly =
  process.argv[1] !== undefined &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (invokedDirectly) {
  main();
}
