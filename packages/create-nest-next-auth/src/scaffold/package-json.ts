import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  BACKEND_PACKAGE_JSON,
  BROWSER_STACK_PACKAGES,
  PLAYWRIGHT_SCRIPT_NAMES,
  POSTGRES_PROTOTYPE_PACKAGES,
} from '../constants/index.js';
import { isRecord } from '../manifest/read.js';
import { readFileIfExists } from '../utils/fs.js';
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
    devDependencies?: Record<string, string>;
  };
  for (const command of PLAYWRIGHT_SCRIPT_NAMES) {
    if (frontend.scripts) delete frontend.scripts[command];
  }
  for (const dependency of BROWSER_STACK_PACKAGES) {
    if (frontend.devDependencies) delete frontend.devDependencies[dependency];
  }
  await writeFile(frontendPath, `${JSON.stringify(frontend, null, 2)}\n`, 'utf8');
  await removePostgresPrototypePackages(root);
  return packageName;
}

/** Drops the PostgreSQL prototype's tooling from the backend, whose files never ship. */
async function removePostgresPrototypePackages(root: string): Promise<void> {
  const backendPath = join(root, BACKEND_PACKAGE_JSON);
  const source = await readFileIfExists(backendPath);
  if (source === undefined) return;

  const backend: unknown = JSON.parse(source);
  if (!isRecord(backend) || !isRecord(backend.devDependencies)) return;
  const prototypeOnly = new Set<string>(POSTGRES_PROTOTYPE_PACKAGES);
  const declared = Object.entries(backend.devDependencies);
  const kept = declared.filter(([name]) => !prototypeOnly.has(name));
  if (kept.length === declared.length) return;
  backend.devDependencies = Object.fromEntries(kept);
  await writeFile(backendPath, `${JSON.stringify(backend, null, 2)}\n`, 'utf8');
}
