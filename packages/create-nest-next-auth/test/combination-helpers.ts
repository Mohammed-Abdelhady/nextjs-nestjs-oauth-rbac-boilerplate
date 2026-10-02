import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readdirSync, readFileSync, symlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format, getFileInfo, resolveConfig } from 'prettier';
import { listFiles } from '../src/utils/fs.js';
import { stripFeatureMarkers } from '../src/prune/markers.js';

export const PACKAGE_DIR = fileURLToPath(new URL('..', import.meta.url));
export const REPO_ROOT = dirname(dirname(PACKAGE_DIR));
export const CLI = join(PACKAGE_DIR, 'dist', 'index.js');
export const BUILD_TIMEOUT = 10 * 60 * 1000;

const ROOT_MODULES = 'node_modules';
const SHARED_SCOPE = '@app';
const SHARED_DIRECTORY = 'shared';

/** Workspaces whose node_modules the generated project borrows. */
const LINKED_MODULES = [
  'backend/node_modules',
  'frontend/node_modules',
  'shared/core/node_modules',
  'shared/sdk/node_modules',
];

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

export function scaffold(
  target: string,
  features: string[],
  flags: string[] = [],
): Promise<CommandResult> {
  return runTool(process.execPath, [
    CLI,
    target,
    '--yes',
    '--features',
    features.join(','),
    ...flags,
    '--no-install',
    '--no-git',
  ]);
}

/** Installs a generated project the way a user would, without lifecycle scripts. */
export function installProject(project: string): Promise<CommandResult> {
  return runTool('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
    cwd: project,
  });
}

/**
 * Builds the project's root node_modules the way an install would: every
 * installed package comes from the repository, and each `@app/<name>` links to
 * the project's own shared/<name>, pruned like the rest of the project.
 */
function linkRootModules(project: string): void {
  const source = join(REPO_ROOT, ROOT_MODULES);
  const target = join(project, ROOT_MODULES);
  mkdirSync(join(target, SHARED_SCOPE), { recursive: true });

  for (const entry of readdirSync(source)) {
    if (entry !== SHARED_SCOPE) symlinkSync(join(source, entry), join(target, entry));
  }
  const shared = join(project, SHARED_DIRECTORY);
  for (const name of existsSync(shared) ? readdirSync(shared) : []) {
    symlinkSync(join(shared, name), join(target, SHARED_SCOPE, name), 'dir');
  }
}

/**
 * Points the generated project at the repository's installed packages. The
 * combinations have to typecheck without an install, which npm would refuse to
 * run offline anyway.
 */
export function linkDependencies(project: string): void {
  linkRootModules(project);
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

/**
 * Name of the temporary tsconfig the combinations write into each generated
 * frontend. It is test scaffolding, never shipped with the template.
 */
export const PRUNED_SHARED_TSCONFIG = 'tsconfig.shared-pruned.json';

/**
 * Writes a frontend tsconfig that maps `@app/core` and `@app/sdk` straight to
 * the generated project's own (pruned) `shared/*` sources, without going
 * through node_modules. Extends the generated `frontend/tsconfig.json`;
 * `paths` replaces the base mapping, so the `@/` alias is repeated here.
 */
export async function writePrunedSharedTsconfig(project: string): Promise<void> {
  const config = {
    extends: './tsconfig.json',
    compilerOptions: {
      paths: {
        '@/*': ['./src/*'],
        '@app/core': ['../shared/core/src/index.ts'],
        '@app/core/*': ['../shared/core/src/*'],
        '@app/sdk': ['../shared/sdk/src/index.ts'],
      },
    },
  };
  await writeFile(
    join(project, 'frontend', PRUNED_SHARED_TSCONFIG),
    `${JSON.stringify(config, null, 2)}\n`,
    'utf8',
  );
}

/** Typechecks the generated frontend against its own pruned `shared/*`. */
export function typecheckFrontendWithPrunedShared(project: string): Promise<CommandResult> {
  return runTool(
    process.execPath,
    [TYPESCRIPT_BIN, '--noEmit', '-p', `frontend/${PRUNED_SHARED_TSCONFIG}`],
    { cwd: project },
  );
}

/** Where the full selection has to match the repository, marker lines aside. */
const COMPARED_DIRECTORIES = [
  'backend/src',
  'backend/test',
  'frontend/src',
  'shared/core/src',
  'shared/sdk/src',
];
const MAINTAINER_BROWSER_HELPERS = new Set([
  'backend/test/utils/browser-server.ts',
  'backend/test/utils/local-oauth.ts',
]);

export interface MarkerDifference {
  file: string;
  reason: string;
}

/** Formats with the repository config, the way the CLI formats a generated tree. */
async function formatLikeRepository(content: string, relative: string): Promise<string | null> {
  const path = join(REPO_ROOT, relative);
  const info = await getFileInfo(path);
  if (info.inferredParser === null) return null;

  const config = await resolveConfig(path);
  return format(content, { ...config, filepath: path });
}

/**
 * Compares a project scaffolded with everything selected against the
 * repository: retained files differ only by markers, and the two maintainer
 * browser helpers must be absent.
 */
export async function compareWithRepository(
  project: string,
  featureIds: string[],
  markerIds: string[],
): Promise<MarkerDifference[]> {
  const kept = new Set(featureIds);
  const known = new Set(markerIds);
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
      const stripped = stripFeatureMarkers(source, relative, kept, known).content;
      const formatted = await formatLikeRepository(stripped, relative);
      const expected = formatted ?? stripped;

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
