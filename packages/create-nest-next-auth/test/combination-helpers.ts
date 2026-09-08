import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listFiles } from '../src/utils/fs.js';
import { stripFeatureMarkers } from '../src/prune/markers.js';

export const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = dirname(dirname(PACKAGE_DIR));
export const CLI = join(PACKAGE_DIR, 'dist', 'index.js');
export const BUILD_TIMEOUT = 10 * 60 * 1000;

/** Workspaces whose node_modules the generated project borrows. */
const LINKED_MODULES = ['node_modules', 'backend/node_modules', 'frontend/node_modules'];

const TYPESCRIPT_BIN = join(REPO_ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

export interface CommandResult {
  ok: boolean;
  output: string;
}

const execute = promisify(execFile);

export async function runTool(
  executable: string,
  args: string[],
  options: { cwd?: string; timeout?: number; signal?: AbortSignal } = {},
): Promise<CommandResult> {
  try {
    const { stdout, stderr } = await execute(executable, args, {
      cwd: options.cwd,
      timeout: options.timeout ?? BUILD_TIMEOUT,
      signal: options.signal,
      maxBuffer: 8 * 1024 * 1024,
      encoding: 'utf8',
      env: { ...process.env, npm_config_update_notifier: 'false' },
    });
    return { ok: true, output: `${stdout}${stderr}` };
  } catch (error) {
    if (!(error instanceof Error)) return { ok: false, output: String(error) };
    const { stdout = '', stderr = '' } = error as Error & { stdout?: string; stderr?: string };
    // execFile already appends stderr to its message; retain each captured stream once.
    const reason =
      stderr && error.message.endsWith(stderr)
        ? error.message.slice(0, -stderr.length)
        : error.message;
    return {
      ok: false,
      output: [reason, stdout, stderr]
        .map((part) => part.trimEnd())
        .filter(Boolean)
        .join('\n'),
    };
  }
}

/** Yield while child tools run so Vitest can process worker messages. */
export function buildCli(): Promise<CommandResult> {
  return runTool('npm', ['run', 'build'], { cwd: PACKAGE_DIR });
}

export function scaffold(target: string, features: string[]): Promise<CommandResult> {
  return runTool(process.execPath, [
    CLI,
    target,
    '--features',
    features.join(','),
    '--no-install',
    '--no-git',
  ]);
}

/**
 * Points the generated project at the repository's installed packages. The
 * combinations have to typecheck without an install, which npm would refuse to
 * run offline anyway.
 */
export function linkDependencies(project: string): void {
  for (const relative of LINKED_MODULES) {
    const source = join(REPO_ROOT, relative);
    // npm hoists to the root, so a workspace may have no node_modules of its own.
    if (!existsSync(source)) continue;

    const link = join(project, relative);
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(source, link, 'dir');
  }
}

export function typecheck(project: string, workspace: string): Promise<CommandResult> {
  return runTool(process.execPath, [TYPESCRIPT_BIN, '--noEmit', '-p', workspace], { cwd: project });
}

/** Where the full selection has to match the repository, marker lines aside. */
const COMPARED_DIRECTORIES = ['backend/src', 'backend/test', 'frontend/src'];
const MAINTAINER_BROWSER_HELPERS = new Set([
  'backend/test/utils/browser-server.ts',
  'backend/test/utils/local-oauth.ts',
]);

export interface MarkerDifference {
  file: string;
  reason: string;
}

/**
 * Compares a project scaffolded with everything selected against the
 * repository: retained files differ only by markers, and the two maintainer
 * browser helpers must be absent.
 */
export async function compareWithRepository(
  project: string,
  featureIds: string[],
): Promise<MarkerDifference[]> {
  const kept = new Set(featureIds);
  const known = new Set(featureIds);
  const differences: MarkerDifference[] = [];

  for (const directory of COMPARED_DIRECTORIES) {
    for (const file of await listFiles(join(REPO_ROOT, directory))) {
      const relative = `${directory}/${file}`;
      if (MAINTAINER_BROWSER_HELPERS.has(relative)) {
        if (existsSync(join(project, relative)))
          differences.push({ file: relative, reason: 'maintainer browser helper was retained' });
        continue;
      }
      const source = readFileSync(join(REPO_ROOT, relative), 'utf8');
      const expected = stripFeatureMarkers(source, relative, kept, known).content;

      let generated: string;
      try {
        generated = readFileSync(join(project, relative), 'utf8');
      } catch {
        differences.push({ file: relative, reason: 'missing from the generated project' });
        continue;
      }
      if (generated !== expected) {
        differences.push({ file: relative, reason: 'differs by more than its markers' });
      }
    }
  }

  return differences;
}
