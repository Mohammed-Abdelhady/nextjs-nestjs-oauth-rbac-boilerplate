import { checkCommit, checkRange } from './git.mjs';
import { git } from './repository-git.mjs';
import { optionalGit, resolveCommit, resolvePushRange } from './refs.mjs';
import {
  BRANCH_REF_PREFIX,
  COMMIT_ABBREVIATION_LENGTH,
  DEFAULT_TRUSTED_REMOTES,
  EMPTY_TRUSTED_REMOTES_LABEL,
  GIT_OBJECT_ID_PATTERN,
  PUSH_BASE_CONFIG,
  PUSH_FETCH_FIRST_MESSAGE,
  PUSH_REMOTE_BASE_REFS,
  REMOTE_REF_PREFIX,
  TRUSTED_REMOTES_CONFIG,
} from '../policy.mjs';
import { resolveDestinations } from './remote-destination.mjs';

function combine(results) {
  const bans = results.flatMap((result) => result.bans);
  const caps = results.flatMap((result) => result.caps);
  return { bans, caps, ok: bans.length === 0 && caps.length === 0 };
}

function trackingOwner(ref, names) {
  return names
    .filter((name) => ref.startsWith(`${REMOTE_REF_PREFIX}${name}/`))
    .sort((a, b) => b.length - a.length)[0];
}

function trustedRemotes(names) {
  const configured = optionalGit(['config', '--get-all', TRUSTED_REMOTES_CONFIG]);
  const requested = configured === null ? DEFAULT_TRUSTED_REMOTES : configured.split(/[\s,]+/);
  const trusted = [...new Set(requested.filter(Boolean))].filter((name) => {
    if (names.includes(name)) return true;
    if (configured !== null)
      console.error(`warning: ignoring an unknown ${TRUSTED_REMOTES_CONFIG} remote.`);
    return false;
  });
  if (
    configured !== null &&
    (trusted.length !== DEFAULT_TRUSTED_REMOTES.length ||
      DEFAULT_TRUSTED_REMOTES.some((name) => !trusted.includes(name)))
  )
    console.error(
      `trusting ${TRUSTED_REMOTES_CONFIG} ${trusted.join(' ') || EMPTY_TRUSTED_REMOTES_LABEL}`,
    );
  return trusted;
}

function trackingRefs() {
  return new Map(
    git(['for-each-ref', '--format=%(refname)%00%(symref)%00%(objectname)', REMOTE_REF_PREFIX])
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((row) => {
        const [ref, target, oid] = row.split('\0');
        return [ref, { target, oid }];
      }),
  );
}

function staleTracking(refs, destinations, tracking, names) {
  const blocked = new Set();
  for (const { remoteRef, remote } of refs) {
    if (!remoteRef.startsWith(BRANCH_REF_PREFIX)) continue;
    for (const name of destinations) {
      const ref = `${REMOTE_REF_PREFIX}${name}/${remoteRef.slice(BRANCH_REF_PREFIX.length)}`;
      if (trackingOwner(ref, names) !== name) continue;
      const cached = tracking.get(ref);
      if (cached && cached.oid !== remote) blocked.add(ref);
    }
  }
  return blocked;
}

function eligibleTracking(ref, { tracking, blocked, names }, allowed) {
  const visited = new Set();
  while (ref && !visited.has(ref)) {
    if (blocked.has(ref) || !allowed.has(trackingOwner(ref, names))) return false;
    visited.add(ref);
    ref = tracking.get(ref)?.target;
  }
  return !ref;
}

function branchBaselines(refs, context) {
  const { destinations, names, trusted, tracking } = context;
  const localRefs = new Set(refs.map(({ localRef }) => localRef));
  const current = localRefs.has('HEAD') ? optionalGit(['symbolic-ref', 'HEAD']) : null;
  const branches = git(['for-each-ref', '--format=%(refname)%00%(upstream)', BRANCH_REF_PREFIX])
    .trim()
    .split('\n')
    .map((row) => row.split('\0'))
    .filter(([name]) => localRefs.has(name) || name === current);
  const allowed = new Set([...destinations, ...trusted]);
  const defaultHeads = trusted
    .map((name) => tracking.get(`${REMOTE_REF_PREFIX}${name}/HEAD`)?.target)
    .filter(Boolean);
  const candidates = [
    ...branches.map(([, upstream]) => upstream).filter(Boolean),
    ...PUSH_REMOTE_BASE_REFS,
    ...defaultHeads,
  ];
  return [...new Set(candidates)].flatMap((ref) => {
    if (!ref.startsWith(REMOTE_REF_PREFIX) || !eligibleTracking(ref, context, allowed)) return [];
    const owner = trackingOwner(ref, names);
    if (!allowed.has(owner)) return [];
    const commit = optionalGit(['rev-parse', '--verify', `${ref}^{commit}`]);
    return commit ? [commit] : [];
  });
}

function explicitBaseline() {
  const configured = optionalGit(['config', '--get', PUSH_BASE_CONFIG]);
  if (configured === null) return [];
  const commit = optionalGit([
    'rev-parse',
    '--verify',
    '--end-of-options',
    `${configured}^{commit}`,
  ]);
  if (!commit || !GIT_OBJECT_ID_PATTERN.test(commit))
    throw new Error(`Cannot resolve ${PUSH_BASE_CONFIG}. Configure one valid commit-ish.`);
  console.error(`trusting ${PUSH_BASE_CONFIG} ${commit.slice(0, COMMIT_ABBREVIATION_LENGTH)}`);
  return [commit];
}

function history(heads, exclusions, context) {
  const { destinations, names, trusted, tracking } = context;
  const allowed = new Set(destinations.length ? destinations : trusted);
  const tracked = [...tracking.keys()].filter(
    (ref) => allowed.has(trackingOwner(ref, names)) && eligibleTracking(ref, context, allowed),
  );
  const revisions = git(['rev-list', '--parents', '--reverse', '--stdin'], {
    input: `${[...heads, ...[...exclusions, ...tracked].map((ref) => `^${ref}`)].join('\n')}\n`,
  }).trim();
  if (!revisions) return { bans: [], caps: [], ok: true };
  return combine(
    revisions.split('\n').map((row) => {
      const [commit, ...parents] = row.split(' ');
      return checkCommit(commit, parents);
    }),
  );
}

function updates(input) {
  return input
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const fields = line.trim().split(/\s+/);
      const remote = fields.pop();
      const destination = fields.pop();
      const local = fields.pop();
      if (
        fields.length === 0 ||
        !destination ||
        ![local, remote].every((oid) => GIT_OBJECT_ID_PATTERN.test(oid))
      )
        throw new Error('Invalid pre-push ref input. Expected local/remote refs and object IDs.');
      return { local, remote, localRef: fields.join(' '), remoteRef: destination };
    });
}

export function checkPush(input = '', { hook = false, remote, remoteUrl } = {}) {
  if (!input.trim()) {
    if (hook) return { bans: [], caps: [], ok: true };
    const { base, head } = resolvePushRange();
    if (base) return checkRange(base, head);
    const names = git(['remote']).trim().split('\n').filter(Boolean);
    return history([head], [], {
      destinations: [],
      names,
      trusted: trustedRemotes(names),
      tracking: trackingRefs(),
      blocked: new Set(),
    });
  }
  const refs = updates(input);
  const active = refs.filter(({ local }) => !/^0+$/.test(local));
  if (active.length === 0) return { bans: [], caps: [], ok: true };
  const heads = [...new Set(active.map(({ local }) => local))].flatMap((local) => {
    const commit = optionalGit(['rev-parse', '--verify', `${local}^{commit}`]);
    if (commit) return [commit];
    const kind = optionalGit(['cat-file', '-t', `${local}^{}`]);
    if (kind === 'tree' || kind === 'blob') return [];
    return [resolveCommit(local, 'pushed local')];
  });
  if (heads.length === 0) return { bans: [], caps: [], ok: true };
  const unresolved = new Set();
  const exclusions = [...new Set(refs.map(({ remote }) => remote))]
    .filter((oid) => !/^0+$/.test(oid))
    .map((oid) => {
      const commit = optionalGit(['rev-parse', '--verify', `${oid}^{commit}`]);
      if (!commit) unresolved.add(oid);
      return commit;
    })
    .filter(Boolean);
  const destinations = resolveDestinations(remote, remoteUrl);
  const names = git(['remote']).trim().split('\n').filter(Boolean);
  const baseline = explicitBaseline();
  if (
    active.some(
      ({ remote, remoteRef }) => remoteRef.startsWith(BRANCH_REF_PREFIX) && unresolved.has(remote),
    )
  )
    console.error(PUSH_FETCH_FIRST_MESSAGE);
  const tracking = trackingRefs();
  const context = {
    destinations,
    names,
    trusted: trustedRemotes(names),
    tracking,
    blocked: staleTracking(active, destinations, tracking, names),
  };
  return history(heads, [...exclusions, ...branchBaselines(active, context), ...baseline], context);
}
