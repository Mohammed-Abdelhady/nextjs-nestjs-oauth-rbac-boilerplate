import { appendFileSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { cacheMetadata, gateEnvironment } from './ci/cache.mjs';
import { fetchTrustedObjects } from './ci/fetch.mjs';
import { eventRange } from './ci/event-range.mjs';
import { runGates, selectGates } from './ci/runner.mjs';
import { gitEnvironment } from './guardrails/git/git-environment.mjs';
import { CI_SCAN_MODES, EXIT_CODES } from './guardrails/policy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const CONFIG = JSON.parse(readFileSync(new URL('./ci/gates.json', import.meta.url), 'utf8'));

export async function main(argv = process.argv.slice(2), env = process.env) {
  try {
    if (argv[0] === '--range' ? ![1, 3, 4].includes(argv.length) : argv.length > 1)
      throw new Error('Expected a CI mode or --range with two explicit commit IDs');
    if (argv[0] === '--fetch') {
      fetchTrustedObjects({ cwd: ROOT, env });
      return EXIT_CODES.OK;
    }
    if (argv[0] === '--cache') {
      const metadata = cacheMetadata(CONFIG, ROOT);
      const output = `path=${metadata.path}\nkey=${metadata.key}\n`;
      if (env.GITHUB_OUTPUT) appendFileSync(env.GITHUB_OUTPUT, output);
      else console.log(output.trim());
      return EXIT_CODES.OK;
    }
    if (argv[0] === '--range') {
      const selection = eventRange({
        cwd: ROOT,
        env,
        base: argv[1],
        head: argv[2],
        currentBase: argv[3],
      });
      if (selection.mode === CI_SCAN_MODES.SKIP) {
        console.log('[ci] Hard-ban range: deleted ref, no content to scan');
        return EXIT_CODES.OK;
      }
      const args =
        selection.mode === CI_SCAN_MODES.ALL
          ? ['--all']
          : ['--range', selection.base, selection.head];
      return await runGates(
        [
          {
            name: `Hard-ban ${selection.mode}`,
            command: 'node',
            args: ['scripts/check-hard-bans.mjs', ...args],
          },
        ],
        { cwd: ROOT, env: gitEnvironment(env) },
      );
    }
    return await runGates(selectGates(CONFIG, argv[0]), {
      cwd: ROOT,
      env: gateEnvironment(CONFIG, ROOT, gitEnvironment(env)),
    });
  } catch (error) {
    console.error(`[ci] Could not run: ${error.message}`);
    return EXIT_CODES.ERROR;
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = await main();
}
