import { git } from './repository-git.mjs';
import { gitEnvironment } from './git-environment.mjs';
import { isAbsolute, relative, resolve, sep, dirname, join } from 'node:path';
import { existsSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function projectRoot() {
  return realpathSync.native(resolve(fileURLToPath(new URL('../../', import.meta.url))));
}

let CACHED_PROJECT_REPOSITORY;

function detachedContext(project, gitRoot) {
  if (!process.env.GIT_DIR) return false;
  realpathSync.native(resolve(process.cwd(), process.env.GIT_DIR));
  if (
    process.env.GIT_WORK_TREE &&
    realpathSync.native(resolve(process.cwd(), process.env.GIT_WORK_TREE)) !== gitRoot
  )
    return false;
  for (let directory = project; ; directory = dirname(directory)) {
    if (existsSync(join(directory, '.git'))) return false;
    if (directory === gitRoot) return true;
  }
}

export function assertProjectRepository(gitRoot) {
  const project = projectRoot();
  const prefix = relative(gitRoot, project);
  const outside = prefix === '..' || prefix.startsWith(`..${sep}`) || isAbsolute(prefix);
  const ownRoot = outside
    ? null
    : (CACHED_PROJECT_REPOSITORY ??= detachedContext(project, gitRoot)
        ? gitRoot
        : realpathSync.native(
            git(['rev-parse', '--show-toplevel'], { cwd: project, env: gitEnvironment() }).trim(),
          ));
  if (ownRoot !== gitRoot) throw new Error('Checker is outside the selected Git repository.');
  return prefix.split(sep).join('/');
}

export function projectRelative(filePath, gitRoot) {
  const prefix = assertProjectRepository(gitRoot);
  if (prefix === '') return filePath;
  return filePath.startsWith(`${prefix}/`) ? filePath.slice(prefix.length + 1) : null;
}
