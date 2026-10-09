import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MANIFEST_FILE, WEB_TARGET_ID } from '../constants/index.js';
import type { Manifest } from '../types.js';
import { isAvailable } from './select.js';
import { ManifestError, validateManifest } from './validate.js';

/** Reads template.manifest.json from a package or repository root. */
export async function loadManifest(root: string): Promise<Manifest> {
  const path = join(root, MANIFEST_FILE);
  const raw = await readFile(path, 'utf8');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`${path} is not valid JSON: ${reason}`);
  }

  const manifest = validateManifest(parsed);
  const problems: string[] = [];
  for (const [id, target] of Object.entries(manifest.targets)) {
    if (id !== WEB_TARGET_ID && isAvailable(target)) {
      problems.push(
        `targets.${id}: generation supports only web; other targets must remain planned`,
      );
    }
    if (target.files.length || target.workspaces.length || target.envFiles.length) {
      problems.push(`targets.${id}: generation does not apply target file ownership yet`);
    }
  }
  for (const [id, shared] of Object.entries(manifest.shared)) {
    if (shared.files.length || shared.workspaces.length) {
      problems.push(`shared.${id}: generation does not apply shared file ownership yet`);
    }
  }
  if (problems.length > 0) throw new ManifestError(problems);
  return manifest;
}
