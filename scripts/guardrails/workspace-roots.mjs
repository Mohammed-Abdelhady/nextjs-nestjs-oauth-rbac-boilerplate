import { globSync, readFileSync } from 'node:fs';
import { WORKSPACE_MANIFEST_WARNING } from './policy.mjs';
import { dirname, resolve } from 'node:path';

export function declaredWorkspaces(root) {
  const manifest = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
  const patterns = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : manifest.workspaces === undefined
      ? []
      : manifest.workspaces?.packages;
  if (!Array.isArray(patterns)) throw new TypeError('Workspace patterns must be an array');
  return [
    ...new Set(patterns.flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }))),
  ]
    .map((file) => dirname(file))
    .sort();
}

const WARNED_ROOTS = new Set();
export function scannerWorkspaceRoots(root) {
  try {
    return ['', ...declaredWorkspaces(root)];
  } catch {
    // Malformed metadata cannot grant workspace exemptions or hide package token violations.
    if (!WARNED_ROOTS.has(root)) {
      console.error(WORKSPACE_MANIFEST_WARNING);
      WARNED_ROOTS.add(root);
    }
    return [''];
  }
}
