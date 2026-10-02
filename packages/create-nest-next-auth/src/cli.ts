import { readdir } from 'node:fs/promises';
import { basename, relative, resolve } from 'node:path';
import { cancel, intro, log, note, outro, spinner } from '@clack/prompts';
import { CLI_NAME, USAGE_EXIT_CODE } from './constants/index.js';
import { ConfigFileError, readConfigFile } from './flags/config-file.js';
import { parseCliOptions } from './flags/options.js';
import { toPlanRequest } from './flags/request.js';
import { loadManifest } from './manifest/load.js';
import { type Plan, resolvePlan } from './manifest/plan.js';
import { packageRoot, templateDir } from './paths.js';
import { prune } from './prune/index.js';
import { askDirectory, CANCELLED } from './prompts/index.js';
import { askPlan, type PlanPromptNeeds, planPromptNeeds } from './prompts/plan.js';
import { describeDangling, describeSelection } from './report.js';
import { buildSummary, describePlanErrors } from './report/summary.js';
import { copyTemplate } from './scaffold/copy.js';
import { initRepository } from './scaffold/git.js';
import { detectPackageManager, installDependencies, isSupported } from './scaffold/install.js';
import { buildDocLinks, buildNextSteps } from './scaffold/next-steps.js';
import { setProjectName } from './scaffold/package-json.js';
import type { CliOptions, Manifest } from './types.js';
import { isErrnoException } from './utils/fs.js';
import { validateProjectName } from './utils/project-name.js';

const DEFAULT_DIRECTORY = 'my-app';

class CliError extends Error {}

async function isEmptyDirectory(path: string): Promise<boolean> {
  try {
    return (await readdir(path)).length === 0;
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return true;
    throw error;
  }
}

/** `cd` target for the next steps: relative when that is not a stack of `..`. */
function shortestPath(target: string): string {
  const fromHere = relative(process.cwd(), target);
  if (fromHere === '') return '.';
  return fromHere.startsWith('..') ? target : fromHere;
}

async function validateTarget(input: string): Promise<string> {
  const target = resolve(process.cwd(), input);
  const check = validateProjectName(basename(target));
  if (!check.valid) throw new CliError(check.message ?? 'Invalid project name.');
  if (!(await isEmptyDirectory(target))) throw new CliError(`${target} exists and is not empty.`);
  return target;
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

  return validateTarget(input);
}

interface PromptNeeds extends PlanPromptNeeds {
  directory: boolean;
}

function requireInteractive(options: CliOptions, needs: PromptNeeds): void {
  const needsPrompt =
    needs.directory || needs.targets || needs.database || needs.features || needs.options;
  if (!needsPrompt || options.yes || process.stdin.isTTY === true) return;
  throw new CliError('No terminal to prompt in. Pass --yes or the matching flags.');
}

async function scaffold(
  target: string,
  manifest: Manifest,
  plan: Plan,
  options: CliOptions,
): Promise<number> {
  const copying = spinner();
  copying.start('Copying the template');
  await copyTemplate(templateDir(), target);
  await setProjectName(target, basename(target));
  copying.stop('Template copied');

  const pruning = spinner();
  pruning.start('Removing what you did not pick');
  const result = await prune(target, manifest, plan.features);
  pruning.stop('Pruned');
  log.message(describeSelection(manifest, result).join('\n'));

  if (result.dangling.length > 0) {
    log.error(describeDangling(result.dangling).join('\n'));
    outro(`Left the tree at ${target} so you can inspect it.`);
    return 1;
  }

  await finishSetup(target, manifest, plan.features, options);
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

export async function main(
  argv: string[],
  version: string,
  manifestRoot = packageRoot(),
): Promise<number> {
  const options = parseCliOptions(argv, version);
  intro(`${CLI_NAME} ${version}`);

  try {
    const manifest = await loadManifest(manifestRoot);
    const config = options.config === undefined ? undefined : await readConfigFile(options.config);
    const request = toPlanRequest(options, config);

    // Flags and the config file are authoritative. Report their errors before
    // any prompt, so an invalid run never asks a question first.
    const requested = resolvePlan(manifest, request);
    if (requested.errors.length > 0) {
      for (const line of describePlanErrors(manifest, requested.errors)) log.error(line);
      outro('Nothing was written.');
      return USAGE_EXIT_CODE;
    }

    const needs: PromptNeeds = {
      directory: !options.dryRun && options.directory === undefined,
      ...planPromptNeeds(manifest, request),
    };
    requireInteractive(options, needs);

    const target = options.dryRun
      ? options.directory === undefined
        ? ''
        : await validateTarget(options.directory)
      : await resolveTarget(options);

    if (!options.yes) {
      const answers = await askPlan(manifest, request, needs);
      if (answers === CANCELLED) throw new CliError('Cancelled.');
      Object.assign(request, answers);
    }

    const plan = resolvePlan(manifest, request);
    if (plan.errors.length > 0) {
      for (const line of describePlanErrors(manifest, plan.errors)) log.error(line);
      outro('Nothing was written.');
      return USAGE_EXIT_CODE;
    }
    if (plan.features.length === 0) throw new CliError('Select at least one sign-in method.');

    log.message(buildSummary(manifest, plan).join('\n'));

    if (options.dryRun) {
      outro('Dry run: nothing written.');
      return 0;
    }

    const code = await scaffold(target, manifest, plan, options);
    if (code === 0) outro('Done.');
    return code;
  } catch (error) {
    if (error instanceof ConfigFileError || error instanceof CliError) {
      cancel(error.message);
      return USAGE_EXIT_CODE;
    }
    throw error;
  }
}
