import { existsSync, lstatSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  countLines,
  evaluateChanges,
  isContentTarget,
  isScanTarget,
  isAllowlistedChecker,
  isTestFile,
  isTextContent,
  parseUnifiedDiff,
} from './checker.mjs';
import {
  GITLINK_MODE,
  GIT_PATH_REPLACEMENT_CHARACTER,
  SYMLINK_MODE,
  SOURCE_SYMLINK_REASON,
  LINE_ENDINGS,
  GIT_PATH_BATCH_BYTES,
  MAX_EXCERPT_LENGTH,
  COMMIT_ABBREVIATION_LENGTH,
} from './policy.mjs';
import { git, readBlobs, repositoryRoot } from './repository-git.mjs';
import { validateGitPath } from './git-paths.mjs';
import { parseRawPatch, requireTargetPatches } from './git-diff.mjs';
import { mergeBase } from './refs.mjs';
import { decodeContent, isUtf16 } from './text-content.mjs';
import { encodedAddedLines } from './encoded-diff.mjs';
import { projectRoot, projectRelative } from './project-paths.mjs';

export { git } from './repository-git.mjs';
export { resolveCommit, resolvePushRange } from './refs.mjs';
const DIFF_OPTIONS = [
  '--raw',
  '-z',
  '--patch',
  '--no-abbrev',
  '-U0',
  '--text',
  '--submodule=short',
  '--ignore-submodules=none',
  '--no-color',
  '--no-ext-diff',
  '--no-textconv',
  '--find-renames',
  '-l0',
  '--no-relative',
  '--src-prefix=a/',
  '--dst-prefix=b/',
  '--diff-filter=ACMRT',
];

function rows(content) {
  const lines = content.split(LINE_ENDINGS);
  if (lines.at(-1) === '') lines.pop();
  return lines.map((text, index) => ({ line: index + 1, text }));
}

function contentTarget(filePath) {
  const local = projectRelative(filePath, repositoryRoot());
  return local !== null && isContentTarget(local);
}

function evaluateEntries(entries) {
  const targets = entries.filter(
    (entry) => entry.mode !== GITLINK_MODE && contentTarget(entry.path),
  );
  const links = targets.filter(
    (entry) =>
      entry.mode === SYMLINK_MODE && isScanTarget(projectRelative(entry.path, repositoryRoot())),
  );
  const regular = targets.filter((entry) => entry.mode !== SYMLINK_MODE);
  const blobs = readBlobs(regular);
  const added = [];
  const lineCounts = [];
  for (const original of regular) {
    const entry = {
      ...original,
      path: projectRelative(original.path, repositoryRoot()),
      previous: projectRelative(original.previous, repositoryRoot()) ?? '',
    };
    const blob = blobs.get(entry.oid);
    if (!isTextContent(entry.path, blob)) continue;
    const content = decodeContent(blob);
    lineCounts.push({ path: entry.path, lines: countLines(content) });
    const movedIntoPolicy =
      /^[RC]/.test(entry.status ?? '') &&
      (!isScanTarget(entry.previous) ||
        isAllowlistedChecker(entry.previous) ||
        (isTestFile(entry.previous) && !isTestFile(entry.path)));
    const addedLines =
      entry.addedLines === undefined || movedIntoPolicy
        ? rows(content)
        : logicalAddedLines(
            content,
            isUtf16(blob) ? encodedAddedLines(entry, content) : entry.addedLines,
          );
    added.push({ path: entry.path, content, addedLines });
  }
  return withSourceLinks(
    evaluateChanges({ added, lineCounts }),
    links.map((entry) => projectRelative(entry.path, repositoryRoot())),
  );
}

function checkDiff(revisions, { rootCommit = false } = {}) {
  const command = rootCommit ? 'diff-tree' : 'diff';
  const argumentsPrefix = rootCommit ? ['--root', '--no-commit-id', '-r'] : [];
  // Enumerate changes first so repository size does not grow the argument list.
  const entries = parseRawPatch(
    git([
      command,
      ...argumentsPrefix,
      ...revisions,
      ...DIFF_OPTIONS.filter((option) => option !== '--patch' && option !== '-U0'),
    ]),
  );
  const targets = entries.filter(
    (entry) => entry.mode !== GITLINK_MODE && contentTarget(entry.path),
  );
  const patches = [];
  const groups = [];
  for (const entry of targets) {
    validateGitPath(entry.path);
    const renamed = /^[RC]/.test(entry.status);
    if (renamed && entry.oldOid === entry.oid) {
      patches.push(entry);
      continue;
    }
    if (
      renamed &&
      (entry.previous.includes(GIT_PATH_REPLACEMENT_CHARACTER) ||
        entries.some((other) => other.path.startsWith(`${entry.previous}/`)))
    ) {
      // Compare blobs when the old name is unsupported or now names a directory.
      const patch = git(['diff', entry.oldOid, entry.oid, ...DIFF_OPTIONS]);
      patches.push({
        ...entry,
        addedLines: parseUnifiedDiff(patch, entry.path).flatMap((file) => file.addedLines),
      });
      continue;
    }
    const paths = [`./${entry.path}`];
    if (renamed && entry.oldMode !== GITLINK_MODE && contentTarget(entry.previous))
      paths.push(`./${validateGitPath(entry.previous)}`);
    groups.push(paths);
  }
  let batch = [];
  let bytes = 0;
  const flush = () => {
    if (batch.length)
      patches.push(
        ...parseRawPatch(
          git([command, ...argumentsPrefix, ...revisions, ...DIFF_OPTIONS, '--', ...batch]),
          {
            requirePatches: true,
          },
        ),
      );
    batch = [];
    bytes = 0;
  };
  for (const paths of groups) {
    const length = paths.reduce((total, filePath) => total + Buffer.byteLength(filePath) + 1, 0);
    if (bytes + length > GIT_PATH_BATCH_BYTES) flush();
    batch.push(...paths);
    bytes += length;
  }
  flush();
  requireTargetPatches(targets, patches);
  return evaluateEntries(patches);
}

function logicalAddedLines(content, addedLines) {
  let logical = 1;
  const offsets = content.split('\n').map((line) => {
    const start = logical;
    logical += line.replace(/\r$/, '').split('\r').length;
    return start;
  });
  return addedLines.flatMap(({ line, text }) => {
    const parts = text.split(LINE_ENDINGS);
    if (parts.at(-1) === '') parts.pop();
    return parts.map((text, index) => ({ line: offsets[line - 1] + index, text }));
  });
}

export function checkRange(base, head) {
  return identify(checkDiff([mergeBase(base, head), head]), head);
}

export function checkStaged() {
  const mergeFile = resolve(
    repositoryRoot(),
    git(['rev-parse', '--git-path', 'MERGE_HEAD']).trim(),
  );
  if (!existsSync(mergeFile)) return checkDiff(['--cached']);
  const parents = ['HEAD', ...readFileSync(mergeFile, 'utf8').trim().split(/\s+/)];
  return intersect(parents.map((parent) => checkDiff(['--cached', parent])));
}

export function checkTree() {
  const root = projectRoot(repositoryRoot());
  const paths = git(['ls-files', '--cached', '--others', '--exclude-standard', '--full-name', '-z'])
    .split('\0')
    .filter(Boolean)
    .map((filePath) => projectRelative(filePath, repositoryRoot()))
    .filter((filePath) => filePath !== null);
  const links = [];
  const added = [];
  const lineCounts = [];
  for (const filePath of new Set(paths)) {
    if (!isContentTarget(filePath)) continue;
    validateGitPath(filePath);
    const absolute = resolve(root, filePath);
    let stat;
    try {
      stat = lstatSync(absolute);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      if (error.code === 'ENAMETOOLONG') {
        console.error(
          `Guardrails warning: skipped an overlong path ${JSON.stringify(filePath.slice(0, MAX_EXCERPT_LENGTH))}`,
        );
        continue;
      }
      throw error;
    }
    if (stat.isSymbolicLink() && isScanTarget(filePath)) {
      links.push(filePath);
      continue;
    }
    if (!stat.isFile()) continue;
    const blob = readFileSync(absolute);
    if (!isTextContent(filePath, blob)) continue;
    const content = decodeContent(blob);
    lineCounts.push({ path: filePath, lines: countLines(content) });
    added.push({ path: filePath, content, addedLines: rows(content) });
  }
  return withSourceLinks(evaluateChanges({ added, lineCounts }), links);
}

export function checkCommit(commit, parents = []) {
  const result =
    parents.length === 0
      ? checkDiff([commit], { rootCommit: true })
      : intersect(parents.map((parent) => checkDiff([parent, commit])));
  return identify(result, commit);
}

function identify(result, commit) {
  const short = commit.slice(0, COMMIT_ABBREVIATION_LENGTH);
  return {
    ...result,
    bans: result.bans.map((hit) => ({ ...hit, commit: short })),
    caps: result.caps.map((hit) => ({ ...hit, commit: short })),
  };
}

function intersect(comparisons) {
  const bans = comparisons[0].bans.filter((hit) =>
    comparisons.every((result) =>
      result.bans.some(
        (other) =>
          other.path === hit.path &&
          other.line === hit.line &&
          other.token === hit.token &&
          other.reason === hit.reason,
      ),
    ),
  );
  const caps = comparisons[0].caps.filter((hit) =>
    comparisons.every((result) => result.caps.some((other) => other.path === hit.path)),
  );
  return { bans, caps, ok: bans.length === 0 && caps.length === 0 };
}

function withSourceLinks(result, paths) {
  const bans = [
    ...result.bans,
    ...paths.map((path) => ({ path, line: 1, reason: SOURCE_SYMLINK_REASON })),
  ];
  return { ...result, bans, ok: result.ok && paths.length === 0 };
}
