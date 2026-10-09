import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { git, readBlobs } from '../git/repository-git.mjs';
import { decodeContent } from './text-content.mjs';
import { parseUnifiedDiff } from './checker.mjs';
import { GITLINK_MODE } from '../policy.mjs';

export function encodedAddedLines(entry, content) {
  let previous = '';
  if (entry.oldOid && !/^0+$/.test(entry.oldOid) && entry.oldMode !== GITLINK_MODE) {
    const blobs = readBlobs([{ oid: entry.oldOid }]);
    previous = decodeContent(blobs.get(entry.oldOid));
  }
  const directory = mkdtempSync(join(tmpdir(), 'guardrail-encoding-'));
  try {
    const before = join(directory, 'before');
    const after = join(directory, 'after');
    writeFileSync(before, previous);
    writeFileSync(after, content);
    let patch;
    try {
      patch = git([
        'diff',
        '--no-index',
        '--no-color',
        '--no-ext-diff',
        '--no-textconv',
        '--text',
        '-U0',
        '--',
        before,
        after,
      ]);
    } catch (error) {
      if (error.status !== 1 || typeof error.stdout !== 'string') throw error;
      patch = error.stdout;
    }
    return parseUnifiedDiff(patch, entry.path).flatMap((file) => file.addedLines);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
