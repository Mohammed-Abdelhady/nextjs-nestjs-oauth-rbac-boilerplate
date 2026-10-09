import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { realpathSync } from 'node:fs';
import {
  GIT_BUFFER_LIMIT_MIB,
  GIT_MAX_BUFFER_BYTES,
  GIT_CWD_RELATIVE_VARIABLES,
} from '../policy.mjs';

function invoke(args, options = {}) {
  try {
    return execFileSync('git', ['-c', 'core.fsmonitor=false', ...args], {
      encoding: 'utf8',
      maxBuffer: GIT_MAX_BUFFER_BYTES,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: process.env,
      cwd: process.cwd(),
      ...options,
    });
  } catch (error) {
    if (error.code === 'ENOBUFS')
      throw new Error(
        `Git output exceeded the ${GIT_BUFFER_LIMIT_MIB} MiB buffer bound. Split the change into smaller batches.`,
      );
    if (error.code === 'E2BIG')
      throw new Error(
        'Git argument/environment size exceeded the operating-system limit. Reduce inherited environment size or split the change.',
      );
    throw error;
  }
}

let CACHED_ROOT;
let CACHED_CONTEXT;

export function repositoryRoot() {
  const context = [process.cwd(), process.env.GIT_DIR, process.env.GIT_WORK_TREE].join('\0');
  if (CACHED_ROOT && CACHED_CONTEXT === context) return CACHED_ROOT;
  try {
    CACHED_CONTEXT = context;
    CACHED_ROOT = realpathSync.native(invoke(['rev-parse', '--show-toplevel']).trim());
    return CACHED_ROOT;
  } catch {
    throw new Error('Not inside a Git repository.');
  }
}

export function git(args, options = {}) {
  const root = repositoryRoot();
  const environment = { ...(options.env ?? process.env) };
  for (const variable of GIT_CWD_RELATIVE_VARIABLES) {
    if (environment[variable])
      environment[variable] = resolve(process.cwd(), environment[variable]);
  }
  return invoke(args, {
    cwd: root,
    ...options,
    env: {
      ...environment,
      ...(environment.GIT_INDEX_FILE
        ? { GIT_INDEX_FILE: resolve(root, environment.GIT_INDEX_FILE) }
        : {}),
      GIT_LITERAL_PATHSPECS: '1',
    },
  });
}

export function readBlobs(entries) {
  const ids = [...new Set(entries.map(({ oid }) => oid))];
  if (ids.length === 0) return new Map();
  // Buffering is deliberate and bounded. Images and gitlinks never enter this batch.
  const output = git(['cat-file', '--batch'], { encoding: null, input: `${ids.join('\n')}\n` });
  const blobs = new Map();
  let offset = 0;
  for (const oid of ids) {
    const end = output.indexOf(10, offset);
    const [actual, kind, rawSize] = output.subarray(offset, end).toString('utf8').split(' ');
    if (actual !== oid || kind !== 'blob') throw new Error(`Cannot read source blob: ${oid}`);
    const size = Number(rawSize);
    if (!Number.isSafeInteger(size) || size < 0 || end + size + 1 >= output.length)
      throw new Error(`Invalid source blob size: ${oid}`);
    blobs.set(oid, output.subarray(end + 1, end + 1 + size));
    offset = end + size + 2;
  }
  return blobs;
}
