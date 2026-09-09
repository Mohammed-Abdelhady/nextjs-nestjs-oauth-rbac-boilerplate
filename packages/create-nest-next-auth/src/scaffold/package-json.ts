import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { toPackageName } from '../utils/project-name.js';

/** Names the generated project and removes commands for the maintainer browser harness. */
export async function setProjectName(root: string, projectName: string): Promise<string> {
  const path = join(root, 'package.json');
  const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
  if (typeof parsed !== 'object' || parsed === null) return projectName;

  const packageName = toPackageName(projectName);
  const updated = { ...(parsed as Record<string, unknown>), name: packageName };
  await writeFile(path, `${JSON.stringify(updated, null, 2)}\n`, 'utf8');
  const frontendPath = join(root, 'frontend', 'package.json');
  const frontend = JSON.parse(await readFile(frontendPath, 'utf8')) as {
    scripts?: Record<string, string>;
  };
  for (const command of ['test:e2e', 'test:e2e:ui', 'test:e2e:headed', 'test:e2e:debug']) {
    if (frontend.scripts) delete frontend.scripts[command];
  }
  await writeFile(frontendPath, `${JSON.stringify(frontend, null, 2)}\n`, 'utf8');
  return packageName;
}
