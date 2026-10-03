import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MARKER_EXTENSIONS, SKIPPED_DIRS } from '../src/constants/index.js';

export const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const BUILD_TIMEOUT = 10 * 60 * 1000;

export interface Packed {
  ok: boolean;
  reason?: string;
  cli: string;
  workspace: string;
}

/** Builds the package, packs it, and unpacks the tarball into a temp directory. */
export function buildAndPack(): Packed {
  const workspace = mkdtempSync(join(tmpdir(), 'cna-e2e-'));
  const packed: Packed = { ok: false, cli: '', workspace };

  try {
    // prepack runs the build, so packing alone ships a fresh template,
    // manifest and identity; a second explicit build would repeat it.
    const output = execFileSync('npm', ['pack', '--pack-destination', workspace], {
      cwd: PACKAGE_DIR,
      timeout: BUILD_TIMEOUT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      // Pack writes to the npm cache. Keep it in the workspace so the test does
      // not depend on write access to the developer's ~/.npm.
      env: { ...process.env, npm_config_cache: join(workspace, 'npm-cache') },
    });
    const tarball = output.trim().split('\n').pop() ?? '';
    execFileSync('tar', ['-xzf', join(workspace, tarball), '-C', workspace], { stdio: 'pipe' });

    packed.cli = join(workspace, 'package', 'dist', 'index.js');
    packed.ok = existsSync(packed.cli);
    if (!packed.ok) packed.reason = 'the tarball has no dist/index.js';
  } catch (error) {
    packed.reason = error instanceof Error ? error.message.split('\n')[0] : String(error);
  }

  if (!packed.ok) rmSync(workspace, { recursive: true, force: true });
  return packed;
}

const MARKER_COMMENT = /(\/\/|\{\/\*)\s*feature:[a-z0-9-]/;

/** Generated source files that still carry a marker comment. */
export function sourceFilesWithMarkers(root: string, prefix = ''): string[] {
  const found: string[] = [];

  for (const entry of readdirSync(join(root, prefix), { withFileTypes: true })) {
    const relative = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) {
      if (SKIPPED_DIRS.has(entry.name)) continue;
      found.push(...sourceFilesWithMarkers(root, relative));
      continue;
    }
    if (!(MARKER_EXTENSIONS as readonly string[]).includes(extname(entry.name))) continue;
    const content = readFileSync(join(root, relative), 'utf8');
    if (MARKER_COMMENT.test(content)) found.push(relative);
  }

  return found;
}

/** Scaffolds one project from the packed CLI into the packed workspace. */
export function scaffold(
  packed: Packed,
  name: string,
  features?: string,
): ReturnType<typeof spawnSync> {
  const target = join(packed.workspace, name);
  const args = [packed.cli, target, '--yes', '--no-install', '--no-git'];
  if (features !== undefined) args.push('--features', features);
  return spawnSync(process.execPath, args, { encoding: 'utf8', timeout: BUILD_TIMEOUT });
}
