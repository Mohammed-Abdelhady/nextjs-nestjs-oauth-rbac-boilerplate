import { existsSync } from 'node:fs';
import { readdir } from 'node:fs/promises';
import { basename, join, relative, resolve } from 'node:path';
import { cancel, intro, log, note, outro, spinner } from '@clack/prompts';
import { CommanderError } from 'commander';
import {
  BROKEN_PACKAGE_EXIT_CODE,
  CLI_NAME,
  DOCKER_OPTION_ID,
  INSTALL_COMMAND,
  USAGE_EXIT_CODE,
} from './constants/index.js';
import { ConfigFileError, readConfigFile } from './flags/config-file.js';
import { RULES_HOOK_PATHS, RULES_WORKFLOW_PATH } from './constants/rules.js';
import { parseCliOptions } from './flags/options.js';
import { toPlanRequest } from './flags/request.js';
import { CliError, BrokenPackageError } from './errors.js';
import { loadManifest } from './manifest/load.js';
import { type Plan, resolvePlan } from './manifest/plan.js';
import { packageRoot, templateDir } from './paths.js';
import { prune } from './prune/index.js';
import { askDirectory, CANCELLED } from './prompts/index.js';
import { askPlan, type PlanPromptNeeds, planPromptNeeds } from './prompts/plan.js';
import { describeDangling, describeSelection } from './report.js';
import { buildSummary, describePlanErrors } from './report/summary.js';
import {
  answersRecord,
  readInstallerIdentity,
  readTemplateIdentity,
  recordAnswers,
} from './scaffold/answers.js';
import { copyTemplate } from './scaffold/copy.js';
import { initRepository } from './scaffold/git.js';
import { installDependencies, prepareLockfile } from './scaffold/install.js';
import { buildDocLinks, buildNextSteps, readWorkspaceStartScripts } from './scaffold/next-steps.js';
import { setProjectName } from './scaffold/package-json.js';
import { writeRulesText } from './scaffold/rules-text.js';
import type { AnswersRecord, CliOptions, Manifest, PruneResult } from './types.js';
import { isErrnoException } from './utils/fs.js';
import { validateProjectName } from './utils/project-name.js';

const DEFAULT_DIRECTORY = 'my-app';

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
    needs.directory ||
    needs.targets ||
    needs.database ||
    needs.features ||
    needs.options ||
    needs.rules;
  if (!needsPrompt || options.yes || process.stdin.isTTY === true) return;
  throw new CliError('No terminal to prompt in. Pass --yes or the matching flags.');
}

async function scaffold(
  target: string,
  manifest: Manifest,
  plan: Plan,
  options: CliOptions,
  answers: AnswersRecord,
): Promise<number> {
  const copying = spinner();
  copying.start('Copying the template');
  try {
    await copyTemplate(templateDir(), target);
    await setProjectName(target, basename(target));
  } catch (error) {
    copying.stop('Copying failed');
    log.error(error instanceof Error ? error.message : String(error));
    outro(`Left the tree at ${target} so you can inspect it.`);
    return 1;
  }
  copying.stop('Template copied');

  const pruning = spinner();
  pruning.start('Removing what you did not pick');
  let result: PruneResult;
  try {
    result = await prune(target, manifest, plan.features, plan.options, plan.rules);
  } catch (error) {
    pruning.stop('Pruning failed');
    const reason = error instanceof Error ? error.message : String(error);
    log.error(`Pruning failed: ${reason}`);
    outro(`Left the tree at ${target} so you can inspect it.`);
    return 1;
  }
  pruning.stop('Pruned');
  await writeRulesText({
    projectRoot: target,
    level: plan.rules,
    delivery: {
      hooks: RULES_HOOK_PATHS.every((path) => existsSync(join(target, path))),
      actions: existsSync(join(target, RULES_WORKFLOW_PATH)),
    },
  });
  log.message(describeSelection(manifest, result).join('\n'));
  const lockfileUpdating = spinner();
  lockfileUpdating.start('Updating pnpm lockfile');
  let lockfile: Awaited<ReturnType<typeof prepareLockfile>>;
  try {
    lockfile = await prepareLockfile(target);
  } catch (error) {
    lockfileUpdating.stop('pnpm lockfile update failed');
    const reason = error instanceof Error ? error.message : String(error);
    log.error(`Could not prepare the pnpm lockfile: ${reason}`);
    outro(`Left the tree at ${target} so you can inspect it.`);
    return 1;
  }
  lockfileUpdating.stop(lockfile.ok ? 'pnpm lockfile updated' : 'pnpm lockfile update failed');
  if (!lockfile.ok && options.install) {
    log.error(
      `pnpm-lock.yaml removed; dependency installation was skipped. ${lockfile.reason ?? 'The lockfile could not be updated.'}`,
    );
  } else if (!lockfile.ok) {
    log.message(
      `pnpm-lock.yaml removed. ${lockfile.reason ?? 'The lockfile could not be updated.'}`,
    );
  }
  if (result.dangling.length > 0) {
    log.error(describeDangling(result.dangling).join('\n'));
    outro(`Left the tree at ${target} so you can inspect it.`);
    return 1;
  }

  // Records how the project was made, before any git commit and on runs that
  // skip git or install alike. --dry-run never reaches this branch.
  await recordAnswers(target, answers);

  return (await finishSetup(target, manifest, plan, options, lockfile.ok)) ? 0 : 1;
}

async function finishSetup(
  target: string,
  manifest: Manifest,
  plan: Plan,
  options: CliOptions,
  lockfileReady: boolean,
): Promise<boolean> {
  if (options.git) {
    const git = await initRepository(target);
    if (git.enclosingWorkTree !== undefined) {
      const status = git.ok ? 'Created a separate repository' : 'Separate repository setup failed';
      log.warn(`Target is inside the git work tree at ${git.enclosingWorkTree}. ${status}.`);
    }
    if (git.ok) log.step('Created a git repository with a first commit');
    else log.warn(`Skipped git: ${git.reason ?? 'git is not available'}`);
  }

  let installed = false;
  if (options.install && lockfileReady) {
    const installing = spinner();
    installing.start('Installing dependencies with pnpm');
    const install = await installDependencies(target);
    installed = install.ok;
    if (install.ok) {
      installing.stop('Dependencies installed');
    } else {
      installing.stop('pnpm install failed');
      log.error(install.reason ?? `Run ${INSTALL_COMMAND} in the project directory.`);
    }
  }

  const directoryLabel = shortestPath(target);
  const scripts = await readWorkspaceStartScripts(target);
  note(
    buildNextSteps({
      directoryLabel,
      installed,
      docker: plan.options.includes(DOCKER_OPTION_ID),
      scripts,
    }).join('\n'),
    'Next steps',
  );
  note(buildDocLinks(manifest, plan.features).join('\n'), 'Docs');
  return !options.install || (lockfileReady && installed);
}

export async function main(
  argv: string[],
  manifestRoot = packageRoot(),
  installerRoot = packageRoot(),
): Promise<number> {
  try {
    // The installer identifies itself once, before anything is parsed or
    // written: commander prints this version, the answers file records it,
    // and a damaged package stops a scaffolding run and a dry run alike.
    const installer = await readInstallerIdentity(installerRoot);
    const options = parseCliOptions(argv, installer.version);
    intro(`${CLI_NAME} ${installer.version}`);

    const manifest = await loadManifest(manifestRoot);
    const template = await readTemplateIdentity(manifestRoot);
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

    const code = await scaffold(
      target,
      manifest,
      plan,
      options,
      answersRecord(installer, template, plan),
    );
    if (code === 0) outro('Done.');
    return code;
  } catch (error) {
    // Commander's own exits (--help, --version, flag syntax) keep its codes.
    if (error instanceof CommanderError) throw error;
    if (error instanceof BrokenPackageError) {
      cancel(error.message);
      return BROKEN_PACKAGE_EXIT_CODE;
    }
    if (error instanceof ConfigFileError || error instanceof CliError) {
      cancel(error.message);
      return USAGE_EXIT_CODE;
    }
    throw error;
  }
}
