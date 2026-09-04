const SPECIAL_CHARS = /[.+^${}()|[\]\\]/g;

/**
 * Translates a posix-style glob into a RegExp. Supports `?`, `*` (one segment)
 * and `**` (any number of segments). Enough for manifest paths; no braces or
 * character classes.
 */
export function globToRegExp(glob: string): RegExp {
  let pattern = '';
  let index = 0;

  while (index < glob.length) {
    const char = glob[index];

    if (char === '*') {
      const isDoubleStar = glob[index + 1] === '*';
      if (isDoubleStar) {
        const skipsSlash = glob[index + 2] === '/';
        pattern += skipsSlash ? '(?:.*\\/)?' : '.*';
        index += skipsSlash ? 3 : 2;
        continue;
      }
      pattern += '[^/]*';
      index += 1;
      continue;
    }

    if (char === '?') {
      pattern += '[^/]';
      index += 1;
      continue;
    }

    pattern += char.replace(SPECIAL_CHARS, '\\$&');
    index += 1;
  }

  return new RegExp(`^${pattern}$`);
}

export function matchesGlob(path: string, glob: string): boolean {
  return globToRegExp(glob).test(path);
}

export function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((glob) => matchesGlob(path, glob));
}
