import { git } from './repository-git.mjs';
import { PUSH_BASE_REFS } from '../policy.mjs';

export function optionalGit(args) {
  try {
    return git(args).trim();
  } catch {
    return null;
  }
}

export function resolveCommit(ref, label) {
  if (!ref || ref.startsWith('-'))
    throw new Error(`Cannot resolve ${label} commit: ${ref ?? '(missing)'}`);
  try {
    return git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]).trim();
  } catch {
    throw new Error(`Cannot resolve ${label} commit: ${ref}`);
  }
}

export function mergeBase(base, head) {
  const common = optionalGit(['merge-base', base, head]);
  if (!common) throw new Error('Cannot resolve merge base. Fetch the shared history first.');
  return common;
}

export function resolvePushRange() {
  const head = resolveCommit('HEAD', 'push head');
  const branch = optionalGit(['symbolic-ref', '--short', 'HEAD']);
  const upstream = optionalGit(['rev-parse', '--verify', '@{upstream}^{commit}']);
  const defaultRef = optionalGit(['symbolic-ref', 'refs/remotes/origin/HEAD']);
  const candidates = [
    upstream,
    defaultRef,
    ...PUSH_BASE_REFS.filter((ref) => ref !== `refs/heads/${branch}`),
  ].filter(Boolean);
  const scores = new Map();
  for (const ref of candidates) {
    const commit = optionalGit(['rev-parse', '--verify', `${ref}^{commit}`]);
    if (!commit) continue;
    const common = optionalGit(['merge-base', '--all', commit, head]);
    if (!common) continue;
    for (const base of common.split('\n')) {
      if (!scores.has(base))
        scores.set(base, Number(git(['rev-list', '--count', `${base}..${head}`]).trim()));
    }
  }
  const closest = [...scores].sort(
    ([a, countA], [b, countB]) => countA - countB || a.localeCompare(b),
  )[0];
  if (closest) return { base: closest[0], head };
  const roots = optionalGit(['rev-list', '--max-parents=0', head]);
  if (!roots) throw new Error('Cannot resolve push root commits.');
  return { base: roots.includes('\n') ? null : roots, head };
}
