import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toPackageName } from '../utils/project-name.js';

/** Renames the generated root package. Nothing else in the file is touched. */
export async function setProjectName(root: string, projectName: string): Promise<string> {
  const path = join(root, 'package.json');
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) return projectName;

  const packageName = toPackageName(projectName);
  const updated = { ...(parsed as Record<string, unknown>), name: packageName };
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  return packageName;
}
