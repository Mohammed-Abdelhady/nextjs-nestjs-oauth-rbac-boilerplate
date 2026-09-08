import { readdir } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { cancel, intro, log, note, outro, spinner } from '@clack/prompts';
import { CLI_NAME } from './constants/index.js';
import { parseCliOptions } from './flags/options.js';
import { loadManifest } from './manifest/load.js';
import { defaultFeatureIds, resolveSelection } from './manifest/select.js';
import { packageRoot, templateDir } from './paths.js';
import { prune } from './prune/index.js';
import { askDirectory, askFeatures, CANCELLED } from './prompts/index.js';
import { describeDangling, describeSelection } from './report.js';
import { copyTemplate } from './scaffold/copy.js';
import { initRepository } from './scaffold/git.js';
import { detectPackageManager, installDependencies, isSupported } from './scaffold/install.js';
import { buildDocLinks, buildNextSteps } from './scaffold/next-steps.js';
import { setProjectName } from './scaffold/package-json.js';
import type { CliOptions, Manifest } from './types.js';
import { validateProjectName } from './utils/project-name.js';

const DEFAULT_DIRECTORY = 'my-app';

class CliError extends Error {}

async function isEmptyDirectory(path: string): Promise<boolean> {
  try {
    return (await readdir(path)).length === 0;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    throw error;
  }
}

/** `cd` target for the next steps: relative when that is not a stack of `..`. */
function shortestPath(target: string): string {
  const fromHere = relative(process.cwd(), target);
  if (fromHere === '') return '.';
  return fromHere.startsWith('..') ? target : fromHere;
}

async function resolveTarget(options: CliOptions): Promise<string> {
  let input = options.directory;

  if (input === undefined) {
    if (options.yes) {
      input = DEFAULT_DIRECTORY;
    } else {
      const answer = await askDirectory(DEFAULT_DIRECTORY);
      if (answer === CANCELLED) throw new CliError('Cancelled.');
      input = answer;
    }
  }

  const target = resolve(process.cwd(), input);
  const check = validateProjectName(basename(target));
  if (!check.valid) throw new CliError(check.message ?? 'Invalid project name.');
  if (!(await isEmptyDirectory(target))) throw new CliError(`${target} exists and is not empty.`);
  return target;
}

async function resolveFeatures(manifest: Manifest, options: CliOptions): Promise<string[]> {
  if (options.features !== undefined) return options.features;
  if (options.yes) return defaultFeatureIds(manifest);

  const answer = await askFeatures(manifest, defaultFeatureIds(manifest));
  if (answer === CANCELLED) throw new CliError('Cancelled.');
  return answer;
}

function requireInteractive(options: CliOptions): void {
  const needsPrompt = options.directory === undefined || options.features === undefined;
  if (!needsPrompt || options.yes || process.stdin.isTTY === true) return;
  throw new CliError('No terminal to prompt in. Pass a directory with --yes or --features.');
}

async function scaffold(target: string, manifest: Manifest, options: CliOptions): Promise<number> {
  const selection = resolveSelection(manifest, await resolveFeatures(manifest, options));
  if (selection.rejected.length > 0) {
    log.warn(`Not available yet, skipped: ${selection.rejected.join(', ')}`);
  }
  if (selection.selected.length === 0) throw new CliError('Select at least one sign-in method.');
  if (selection.added.length > 0) {
    log.info(`Added because another method needs it: ${selection.added.join(', ')}`);
  }

  const copying = spinner();
  copying.start('Copying the template');
  await copyTemplate(templateDir(), target);
  await setProjectName(target, basename(target));
  copying.stop('Template copied');

  const pruning = spinner();
  pruning.start('Removing what you did not pick');
  const result = await prune(target, manifest, selection.selected);
  pruning.stop('Pruned');
  log.message(describeSelection(manifest, result).join('\n'));

  if (result.dangling.length > 0) {
    log.error(describeDangling(result.dangling).join('\n'));
    outro(`Left the tree at ${target} so you can inspect it.`);
    return 1;
  }

  await finishSetup(target, manifest, selection.selected, options);
  return 0;
}

async function finishSetup(
  target: string,
  manifest: Manifest,
  selected: string[],
  options: CliOptions,
): Promise<void> {
  if (options.git) {
    const git = await initRepository(target);
    if (git.ok) log.step('Created a git repository with a first commit');
    else log.warn(`Skipped git: ${git.reason ?? 'git is not available'}`);
  }

  const manager = detectPackageManager();
  if (options.install && !isSupported(manager)) {
    log.warn(`${manager} is not supported yet, using npm.`);
  }

  let installed = false;
  if (options.install) {
    const installing = spinner();
    installing.start('Installing dependencies with npm');
    const install = await installDependencies(target);
    installed = install.ok;
    if (install.ok) {
      installing.stop('Dependencies installed');
    } else {
      installing.stop('npm install failed');
      log.error(install.reason ?? 'Run npm install in the project directory.');
    }
  }

  const directoryLabel = shortestPath(target);
  note(buildNextSteps({ directoryLabel, installed }).join('\n'), 'Next steps');
  note(buildDocLinks(manifest, selected).join('\n'), 'Docs');
}

export async function main(argv: string[], version: string): Promise<number> {
  const options = parseCliOptions(argv, version);
  intro(`${CLI_NAME} ${version}`);

  try {
    requireInteractive(options);
    const manifest = await loadManifest(packageRoot());
    const target = await resolveTarget(options);
    const code = await scaffold(target, manifest, options);
    if (code === 0) outro('Done.');
    return code;
  } catch (error) {
    if (error instanceof CliError) {
      cancel(error.message);
      return 1;
    }
    throw error;
  }
}
