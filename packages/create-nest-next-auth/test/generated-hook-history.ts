import { chmodSync, copyFileSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { git, isolatedGit } from './answers-helpers.js';
import { boundedGitPush } from './bounded-git-push.js';
import { scaffold, type Packed } from './packed-cli.js';

const DOM_TOKEN = 'inner' + 'HTML';
const SOURCE_PATH = 'backend/src/guardrail-probe.ts';
const CLEAN = 'export const guardrailProbe = 1;\n';

export function checkGeneratedHookHistory(packed: Packed): void {
  const { env } = isolatedGit(packed.workspace);
  const generated = scaffold(packed, 'guardrails-hook-history', undefined, { git: true, env });
  expect(generated.status, `${generated.stdout}\n${generated.stderr}`).toBe(0);
  const project = join(packed.workspace, 'guardrails-hook-history');
  const remote = join(packed.workspace, 'guardrails-hook-history.git');
  git(['config', 'user.name', 'Fixture'], project, env);
  git(['config', 'user.email', 'fixture@example.test'], project, env);
  git(['branch', '-M', 'main'], project, env);
  git(['init', '--bare', '--initial-branch=main', remote], packed.workspace, env);
  git(['remote', 'add', 'origin', remote], project, env);
  const initial = boundedGitPush(['-u', 'origin', 'main'], project, env);
  expect(initial.status, initial.stderr).toBe(0);
  const baseline = git(['rev-parse', 'HEAD'], project, env).trim();

  // Lifecycle shims observe scan-before-gates without installing dependencies.
  const packagePath = join(project, 'package.json');
  const packageJson = JSON.parse(git(['show', 'HEAD:package.json'], project, env)) as {
    scripts: Record<string, string>;
  };
  for (const script of ['lint', 'typecheck', 'test']) {
    packageJson.scripts[script] = `node .git/guardrail-gate.mjs ${script}`;
  }
  writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(
    join(project, '.git/guardrail-gate.mjs'),
    "import { appendFileSync } from 'node:fs';\n" +
      "appendFileSync('.git/guardrail-gates', `${process.argv[2]}\\n`);\n",
  );
  writeFileSync(join(project, SOURCE_PATH), CLEAN + `host.${DOM_TOKEN} = value;\n`);
  git(['add', 'package.json', SOURCE_PATH], project, env);
  git(['commit', '-m', 'test: pre-hook local violation'], project, env);
  const offending = git(['rev-parse', 'HEAD'], project, env).trim();
  git(['switch', '-c', 'feat'], project, env);
  writeFileSync(join(project, 'backend/src/guardrail-child.ts'), CLEAN);
  git(['add', 'backend/src/guardrail-child.ts'], project, env);
  git(['commit', '-m', 'test: clean child'], project, env);
  const hook = join(project, '.git/hooks/pre-push');
  copyFileSync(join(project, '.husky/pre-push'), hook);
  chmodSync(hook, 0o755);

  const pushed = boundedGitPush(['origin', 'feat'], project, env);
  const hits = [
    ...pushed.stderr.matchAll(/^\[([a-f0-9]+)\] (.+?):(\d+): banned token "((?:\\.|[^"\\])*)"/gm),
  ].map((match) => [match[1], match[2], Number(match[3]), JSON.parse(`"${match[4]}"`)]);
  expect({
    status: pushed.status,
    hits,
    gatesRan: existsSync(join(project, '.git/guardrail-gates')),
    refs: git(['for-each-ref', '--format=%(objectname) %(refname)'], remote, env).trim(),
  }).toEqual({
    status: 1,
    hits: [[offending.slice(0, 7), SOURCE_PATH, 2, DOM_TOKEN]],
    gatesRan: false,
    refs: `${baseline} refs/heads/main`,
  });
}
