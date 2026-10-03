import { realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILE_URL_SCHEME, GIT_URL_SUFFIX } from './policy.mjs';
import { git, repositoryRoot } from './repository-git.mjs';
import { optionalGit } from './refs.mjs';

function stripSuffix(value) {
  const withoutSlash = value.endsWith('/') ? value.slice(0, -1) : value;
  return withoutSlash.endsWith(GIT_URL_SUFFIX)
    ? withoutSlash.slice(0, -GIT_URL_SUFFIX.length)
    : withoutSlash;
}

function normalize(value) {
  let local = value;
  if (value.startsWith(FILE_URL_SCHEME)) {
    try {
      local = fileURLToPath(value);
    } catch {
      return stripSuffix(value);
    }
  } else if (!isAbsolute(value) && /^[^/\\]+:/.test(value)) {
    return stripSuffix(value);
  }
  const absolute = resolve(repositoryRoot(), local);
  let canonical;
  try {
    canonical = realpathSync.native(absolute);
  } catch {
    try {
      canonical = realpathSync.native(absolute + GIT_URL_SUFFIX);
    } catch {
      canonical = absolute;
    }
  }
  return stripSuffix(canonical);
}

export function resolveDestinations(remote, remoteUrl) {
  if (!remote && !remoteUrl) return [];
  const names = git(['remote']).trim().split('\n').filter(Boolean);
  if (names.includes(remote)) return [remote];
  const candidates = [remoteUrl, remote].filter(Boolean).map(normalize);
  return names.filter((name) => {
    const urls = [
      optionalGit(['remote', 'get-url', '--all', name]),
      optionalGit(['remote', 'get-url', '--push', '--all', name]),
    ].filter(Boolean);
    return urls.some((value) =>
      value
        .trim()
        .split('\n')
        .some((url) => candidates.includes(normalize(url))),
    );
  });
}
