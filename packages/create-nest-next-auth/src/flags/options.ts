import { Command, Option } from 'commander';
import {
  CLI_NAME,
  DOCKER_OPTION_ID,
  PRODUCTION_OPTION_ID,
  RULES_POLICIES,
} from '../constants/index.js';
import type { CliOptions, RulesPolicy } from '../types.js';

interface RawOptions {
  yes?: boolean;
  rules?: RulesPolicy;
  features?: string;
  targets?: string;
  database?: string;
  preset?: string;
  config?: string;
  locales?: string;
  docker?: boolean;
  production?: boolean;
  dryRun?: boolean;
  install: boolean;
  git: boolean;
}

/** Trims, lowercases and drops empty entries from a comma separated list. */
export function splitList(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry) => entry.length > 0);
}

export function buildProgram(version: string): Command {
  return new Command()
    .name(CLI_NAME)
    .description('Scaffold a NestJS and Next.js authentication project.')
    .version(version, '-v, --version')
    .argument('[directory]', 'directory to create, defaults to a prompt')
    .option('-y, --yes', 'accept the defaults and skip the prompts')
    .addOption(
      new Option('--rules <policy>', 'rules: strict (recommended) or standard').choices([
        ...RULES_POLICIES,
      ]),
    )
    .option('--features <list>', 'comma separated feature ids, skips the feature prompt')
    .option('--targets <list>', 'comma separated client ids, skips the client prompt')
    .option('--database <list>', 'database id; more than one is an error')
    .option('--preset <id>', 'apply a preset (minimal, standard, everything)')
    .option('--config <file>', 'JSON file with the same selection keys')
    .option('--locales <list>', 'locale ids; "en" is required, "ar" adds Arabic')
    .option('--no-docker', 'leave out the Docker files')
    .option('--no-production', 'leave out the production nginx and compose files')
    .option('--dry-run', 'print the resolved plan and write nothing')
    .option('--no-install', 'skip dependency installation')
    .option('--no-git', 'skip git init and the first commit')
    .allowExcessArguments(false)
    .exitOverride();
}

/** Parses user arguments. Throws CommanderError on bad input, --help and --version. */
export function parseCliOptions(argv: string[], version = '0.0.0'): CliOptions {
  const program = buildProgram(version);
  program.parse(argv, { from: 'user' });

  const raw = program.opts<RawOptions>();
  const optionOverrides: Partial<Record<string, boolean>> = {};
  if (program.getOptionValueSource(DOCKER_OPTION_ID) === 'cli') {
    optionOverrides[DOCKER_OPTION_ID] = raw.docker === true;
  }
  if (program.getOptionValueSource(PRODUCTION_OPTION_ID) === 'cli') {
    optionOverrides[PRODUCTION_OPTION_ID] = raw.production === true;
  }

  return {
    directory: program.args[0],
    yes: raw.yes === true,
    rules: raw.rules,
    features: raw.features === undefined ? undefined : splitList(raw.features),
    targets: raw.targets === undefined ? undefined : splitList(raw.targets),
    databases: raw.database === undefined ? undefined : splitList(raw.database),
    preset: raw.preset === undefined ? undefined : raw.preset.trim().toLowerCase(),
    config: raw.config,
    dryRun: raw.dryRun === true,
    locales: raw.locales === undefined ? undefined : splitList(raw.locales),
    optionOverrides,
    install: raw.install,
    git: raw.git,
  };
}
