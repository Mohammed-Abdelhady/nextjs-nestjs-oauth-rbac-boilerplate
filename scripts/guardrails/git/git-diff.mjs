import { parseUnifiedDiff } from '../scanner/checker.mjs';

export function parseRawPatch(output, { requirePatches = false } = {}) {
  const entries = [];
  let offset = 0;
  const field = () => {
    const end = output.indexOf('\0', offset);
    if (end === -1) throw new Error('Incomplete Git diff metadata.');
    const value = output.slice(offset, end);
    offset = end + 1;
    return value;
  };
  while (output[offset] === ':') {
    const [oldMode, mode, oldOid, oid, status] = field().slice(1).split(' ');
    const previous = field();
    const filePath = /^[RC]/.test(status) ? field() : previous;
    entries.push({ path: filePath, previous, oldMode, mode, oldOid, oid, status, addedLines: [] });
  }
  const patch = output.slice(offset).replace(/^\0/, '');
  let index = -1;
  let lines = [];
  let header;
  const flush = () => {
    if (index < 0 || index >= entries.length) return;
    entries[index].addedLines = parseUnifiedDiff(lines.join('\n'), entries[index].path).flatMap(
      (file) => file.addedLines,
    );
  };
  for (const line of patch.split('\n')) {
    if (line.startsWith('diff --git ')) {
      if (!/^diff --git (?:a\/|"a\/).+ (?:b\/|"b\/)/.test(line))
        throw new Error('Git patch header has unexpected path prefixes.');
      flush();
      // A type change has separate deletion/addition patches for the same path.
      if (line !== header || entries[index]?.status !== 'T') index += 1;
      header = line;
      lines = [];
    }
    lines.push(line);
  }
  flush();
  if (requirePatches && index + 1 !== entries.length)
    throw new Error('Git patch count does not match metadata.');
  return entries;
}

export function requireTargetPatches(targets, patches) {
  const counts = new Map();
  for (const entry of patches) {
    const key = `${entry.path}\0${entry.oid}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  for (const target of targets) {
    if (counts.get(`${target.path}\0${target.oid}`) !== 1)
      throw new Error(
        'Git content patch is missing or duplicated for a target path; refusing to scan.',
      );
  }
}
