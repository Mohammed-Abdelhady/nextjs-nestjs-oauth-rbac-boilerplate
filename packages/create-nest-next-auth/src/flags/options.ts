import { Command } from 'commander';
import { CLI_NAME } from '../constants/index.js';
import type { CliOptions } from '../types.js';

interface RawOptions {
  yes?: boolean;
  features?: string;
  install: boolean;
  git: boolean;
}

export function splitFeatureList(value: string): string[] {
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
    .option('--features <list>', 'comma separated feature ids, skips the feature prompt')
    .option('--no-install', 'skip npm install')
    .option('--no-git', 'skip git init and the first commit')
    .allowExcessArguments(false)
    .exitOverride();
}

/** Parses user arguments. Throws CommanderError on bad input, --help and --version. */
export function parseCliOptions(argv: string[], version = '0.0.0'): CliOptions {
  const program = buildProgram(version);
  program.parse(argv, { from: 'user' });

  const raw = program.opts<RawOptions>();
  return {
    directory: program.args[0],
    yes: raw.yes === true,
    features: raw.features === undefined ? undefined : splitFeatureList(raw.features),
    install: raw.install,
    git: raw.git,
  };
}
