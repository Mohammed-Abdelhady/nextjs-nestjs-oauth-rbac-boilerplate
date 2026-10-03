import { GIT_REPOSITORY_VARIABLES } from './policy.mjs';

export function gitEnvironment(source = process.env, { indexFile } = {}) {
  const environment = { ...source };
  for (const variable of GIT_REPOSITORY_VARIABLES) delete environment[variable];
  if (indexFile) environment.GIT_INDEX_FILE = indexFile;
  return environment;
}
