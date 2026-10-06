import { GIT_PATH_REPLACEMENT_CHARACTER } from './policy.mjs';

export function validateGitPath(filePath) {
  if (filePath.includes(GIT_PATH_REPLACEMENT_CHARACTER))
    throw new Error(
      `Git target path ${JSON.stringify(filePath)} contains an unsupported replacement character; rename the file.`,
    );
  return filePath;
}
