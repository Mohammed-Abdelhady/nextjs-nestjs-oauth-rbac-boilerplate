import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { gitEnvironment } from '../guardrails/git/git-environment.mjs';
import {
  CI_EVENT_NAMES,
  CI_SCAN_MODES,
  GIT_MAX_BUFFER_BYTES,
  GIT_OBJECT_ID_PATTERN,
} from '../guardrails/policy.mjs';
import { selectRange } from './range.mjs';

export function eventRange({ cwd, env = process.env, base, head, currentBase }) {
  const git = (args) =>
    spawnSync('git', args, {
      cwd,
      env: gitEnvironment(env),
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
    });
  if (base !== undefined || head !== undefined) {
    if (
      ![base, head, ...(currentBase === undefined ? [] : [currentBase])].every(
        (id) => typeof id === 'string' && GIT_OBJECT_ID_PATTERN.test(id) && !/^0+$/.test(id),
      )
    )
      throw new Error('Invalid explicit range commit IDs');
    const checkedOut = git(['rev-parse', '--verify', 'HEAD^{commit}']);
    if (checkedOut.status !== 0 || checkedOut.stdout.trim() !== base)
      throw new Error('The checkout does not match the explicit base commit');
    if (currentBase !== undefined) {
      const common = git(['merge-base', currentBase, head]);
      const resolved = common.stdout?.trim();
      if (common.status !== 0 || !GIT_OBJECT_ID_PATTERN.test(resolved ?? ''))
        throw new Error('Could not find a merge base with the current base tip');
      return { mode: CI_SCAN_MODES.RANGE, base: resolved, head };
    }
    return { mode: CI_SCAN_MODES.RANGE, base, head };
  }
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const eventName = env.GITHUB_EVENT_NAME;
  const input = {
    eventName,
    base: event.pull_request?.base?.sha,
    head:
      eventName === CI_EVENT_NAMES.PULL_REQUEST
        ? event.pull_request?.head?.sha
        : (event.after ?? event.merge_group?.head_sha ?? env.GITHUB_SHA),
    before: event.before,
    deleted: event.deleted,
  };
  // Validate event IDs before using them as Git arguments.
  const preliminary = selectRange(input);
  if (preliminary.mode === CI_SCAN_MODES.SKIP) return preliminary;
  const checkedOut = git(['rev-parse', '--verify', 'HEAD^{commit}']);
  if (checkedOut.status !== 0 || checkedOut.stdout.trim() !== input.head) {
    throw new Error('The checkout does not match the event head commit');
  }
  if (eventName === CI_EVENT_NAMES.PULL_REQUEST) return preliminary;
  const beforeIsAncestor =
    typeof input.before === 'string' &&
    GIT_OBJECT_ID_PATTERN.test(input.before) &&
    git(['merge-base', '--is-ancestor', input.before, input.head]).status === 0;
  let defaultMergeBase;
  const defaultBranch = event.repository?.default_branch;
  if (!beforeIsAncestor && typeof defaultBranch === 'string') {
    const ref = `refs/remotes/origin/${defaultBranch}`;
    if (git(['check-ref-format', ref]).status === 0) {
      const resolved = git(['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`]);
      if (resolved.status === 0) {
        const common = git(['merge-base', resolved.stdout.trim(), input.head]);
        if (common.status === 0) defaultMergeBase = common.stdout.trim();
      }
    }
  }
  return selectRange({ ...input, beforeIsAncestor, defaultMergeBase });
}
