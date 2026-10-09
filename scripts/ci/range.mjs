import { CI_EVENT_NAMES, CI_SCAN_MODES, GIT_OBJECT_ID_PATTERN } from '../guardrails/policy.mjs';

function isCommit(value) {
  return typeof value === 'string' && GIT_OBJECT_ID_PATTERN.test(value) && !/^0+$/.test(value);
}

export function selectRange({
  eventName,
  base,
  before,
  head,
  deleted,
  beforeIsAncestor,
  defaultMergeBase,
}) {
  if (deleted || (typeof head === 'string' && /^0{40}$|^0{64}$/.test(head)))
    return { mode: CI_SCAN_MODES.SKIP };
  if (!isCommit(head)) throw new Error('Missing or invalid head commit');
  if (eventName === CI_EVENT_NAMES.PULL_REQUEST) {
    if (!isCommit(base)) throw new Error('Missing or invalid pull request base commit');
    return { mode: CI_SCAN_MODES.RANGE, base, head };
  }
  if (eventName === CI_EVENT_NAMES.PUSH && isCommit(before) && beforeIsAncestor) {
    return { mode: CI_SCAN_MODES.RANGE, base: before, head };
  }
  // A default branch already at the new tip gives an empty range, so scan its tree.
  if (isCommit(defaultMergeBase) && defaultMergeBase !== head) {
    return { mode: CI_SCAN_MODES.RANGE, base: defaultMergeBase, head };
  }
  return { mode: CI_SCAN_MODES.ALL, head };
}
