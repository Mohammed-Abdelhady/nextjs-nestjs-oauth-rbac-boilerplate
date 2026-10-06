import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { extname, resolve, dirname, relative, sep } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { isScanTarget } from './checker.mjs';
import { validateGitPath } from './git-paths.mjs';
import { gitEnvironment } from './git-environment.mjs';
import { EXPLICIT_TYPE_RULE, GIT_MAX_BUFFER_BYTES, TYPESCRIPT_EXTENSIONS } from './policy.mjs';

export { declaredWorkspaces } from './workspace-roots.mjs';
import { declaredWorkspaces, scannerWorkspaceRoots } from './workspace-roots.mjs';

function filesystemTypeFiles(root) {
  const roots = scannerWorkspaceRoots(root);
  const ignore = createRequire(import.meta.url)('ignore');
  function rulesAt(directory) {
    const file = resolve(directory, '.gitignore');
    return existsSync(file)
      ? [{
          directory,
          matcher: ignore().add(readFileSync(file, 'utf8')),
        }]
      : [];
  }
  const ancestors = [];
  for (
    let directory = dirname(root);
    !existsSync(resolve(root, '.git'));
    directory = dirname(directory)
  ) {
    ancestors.unshift(...rulesAt(directory));
    if (existsSync(resolve(directory, '.git')) || dirname(directory) === directory) break;
  }
  function walk(directory, inherited) {
    const rules = [...inherited, ...rulesAt(resolve(root, directory))];
    const files = [];
    for (const entry of readdirSync(resolve(root, directory), { withFileTypes: true })) {
      const file = directory ? `${directory}/${entry.name}` : entry.name;
      let ignored = false;
      for (const { directory: base, matcher } of rules) {
        const target =
          relative(base, resolve(root, file)).split(sep).join('/') +
          (entry.isDirectory() ? '/' : '');
        const result = matcher.test(target);
        if (result.ignored) ignored = true;
        else if (result.unignored) ignored = false;
      }
      if (ignored) continue;
      if (entry.isDirectory()) {
        if (entry.name !== '.git' && isScanTarget(`${file}/probe.ts`, roots)) {
          files.push(...walk(file, rules));
        }
      } else if (
        entry.isFile() &&
        TYPESCRIPT_EXTENSIONS.includes(extname(file).toLowerCase()) &&
        isScanTarget(file, roots)
      ) {
        files.push(file);
      }
    }
    return files;
  }
  return walk('', ancestors).sort();
}

export function trackedTypeFiles(root, { filesystem = false, env = process.env } = {}) {
  if (filesystem) return filesystemTypeFiles(root);
  const options = {
    cwd: root,
    encoding: 'utf8',
    env: gitEnvironment(env),
    maxBuffer: GIT_MAX_BUFFER_BYTES,
    stdio: 'pipe',
  };
  const repository = spawnSync('git', ['rev-parse', '--is-inside-work-tree'], options);
  if (repository.error) throw repository.error;
  if (repository.status !== 0) {
    if (repository.stderr.includes('not a git repository')) return filesystemTypeFiles(root);
    throw new Error(repository.stderr.trim().split(/\r?\n/)[0]);
  }
  const roots = scannerWorkspaceRoots(root);
  return execFileSync('git', ['-c', 'core.fsmonitor=false', 'ls-files', '-z', '--', '.'], options)
    .split('\0')
    .filter(
      (file) =>
        TYPESCRIPT_EXTENSIONS.includes(extname(file).toLowerCase()) && isScanTarget(file, roots),
    )
    .map(validateGitPath)
    .filter((file) => existsSync(resolve(root, file)));
}

export async function workspacePolicyProblems(root, options) {
  const files = trackedTypeFiles(root, options);
  const problems = [];
  for (const workspace of declaredWorkspaces(root)) {
    const workspaceFiles = files.filter((file) => file.startsWith(`${workspace}/`));
    if (workspaceFiles.length === 0) {
      problems.push([workspace, 'no lintable files']);
      continue;
    }
    const cwd = resolve(root, workspace);
    const { ESLint } = createRequire(resolve(cwd, 'package.json'))('eslint');
    const linter = new ESLint({ cwd });
    for (const file of workspaceFiles) {
      const absolute = resolve(root, file);
      if (await linter.isPathIgnored(absolute)) {
        problems.push([file, 'ignored']);
        continue;
      }
      const config = await linter.calculateConfigForFile(absolute);
      if (config?.rules[EXPLICIT_TYPE_RULE]?.[0] !== 2) problems.push([file, 'type rule']);
      if (config?.linterOptions.noInlineConfig !== true) problems.push([file, 'inline config']);
    }
  }
  return problems;
}
