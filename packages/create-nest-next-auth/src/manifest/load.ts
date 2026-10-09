import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { MANIFEST_FILE } from '../constants/index.js';
import type { Manifest } from '../types.js';
import { validateManifest } from './validate.js';

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

  return validateManifest(parsed);
}
