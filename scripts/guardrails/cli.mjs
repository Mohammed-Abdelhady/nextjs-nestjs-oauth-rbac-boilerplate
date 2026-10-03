import { readFileSync, writeFileSync } from 'node:fs';
import { isatty } from 'node:tty';
import { findAttributionHits, stripAttribution } from './checker.mjs';
import { checkRange, checkStaged, checkTree, resolveCommit } from './git.mjs';
import { EMPTY_PUSH_MESSAGE, EXIT_CODES, FILE_LINE_LIMIT, LINE_ENDINGS } from './policy.mjs';
import { checkPush } from './push.mjs';
import { assertProjectRepository } from './project-paths.mjs';
import { repositoryRoot } from './repository-git.mjs';

const USAGE =
  'usage: check-hard-bans.mjs --staged | --push [--hook <remote> [<url>]] | --all | --range <base> <head> | --commit-msg <file>';

function printReport(result) {
  for (const hit of result.bans) {
    console.error(
      `${hit.commit ? `[${hit.commit}] ` : ''}${hit.path}:${hit.line}: banned token ${JSON.stringify(hit.token)}: ${hit.text}`,
    );
  }
  for (const hit of result.caps) {
    console.error(
      `${hit.commit ? `[${hit.commit}] ` : ''}${hit.path}: ${hit.lines} lines (limit ${FILE_LINE_LIMIT}). Split the file by responsibility.`,
    );
  }
  return result.ok ? EXIT_CODES.OK : EXIT_CODES.VIOLATION;
}

export function main(argv = process.argv.slice(2)) {
  try {
    let result;
    if (['--range', '--staged', '--all', '--push'].includes(argv[0]))
      assertProjectRepository(repositoryRoot());
    if (argv[0] === '--range') {
      const base = resolveCommit(argv[1], 'base');
      const head = resolveCommit(argv[2], 'head');
      if (argv.length !== 3) throw new Error(USAGE);
      result = checkRange(base, head);
    } else if (argv[0] === '--staged' && argv.length === 1) {
      result = checkStaged();
    } else if (argv[0] === '--all' && argv.length === 1) {
      result = checkTree();
    } else if (
      argv[0] === '--push' &&
      (argv.length === 1 || (argv[1] === '--hook' && [3, 4].includes(argv.length)))
    ) {
      const input = isatty(0) ? '' : readFileSync(0, 'utf8');
      if (argv[1] === '--hook' && !input.trim()) console.error(EMPTY_PUSH_MESSAGE);
      result = checkPush(input, {
        hook: argv[1] === '--hook',
        remote: argv[2],
        remoteUrl: argv[3],
      });
    } else if (argv[0] === '--commit-msg' && argv.length === 2) {
      const original = readFileSync(argv[1], 'utf8');
      const stripped = stripAttribution(original);
      if (stripped !== original) writeFileSync(argv[1], stripped);
      if (findAttributionHits(stripped).length > 0) {
        throw new Error('Commit message credits a tool. Commit as the author only.');
      }
      return EXIT_CODES.OK;
    } else {
      throw new Error(USAGE);
    }
    return printReport(result);
  } catch (error) {
    console.error(`Guardrails could not run: ${error.message.split(LINE_ENDINGS)[0]}`);
    return EXIT_CODES.ERROR;
  }
}
