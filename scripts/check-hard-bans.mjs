import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { main } from './guardrails/cli.mjs';

export * from './guardrails/checker.mjs';
export { main } from './guardrails/cli.mjs';
export { resolvePushRange } from './guardrails/git.mjs';

if (
  process.argv[1] &&
  existsSync(process.argv[1]) &&
  realpathSync.native(process.argv[1]) === realpathSync.native(fileURLToPath(import.meta.url))
) {
  process.exitCode = main();
}
