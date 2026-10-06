import { globSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join, posix } from 'node:path';
import { parseDocument } from 'yaml';
import { PACKAGE_MANIFEST, PNPM_WORKSPACE_FILE } from '../constants/index.js';
import { isRecord } from '../manifest/read.js';
import { isErrnoException, toPosix } from '../utils/fs.js';

interface WorkspaceDocument {
  document: ReturnType<typeof parseDocument>;
  packages: string[];
}

async function readWorkspace(root: string): Promise<WorkspaceDocument | undefined> {
  const path = join(root, PNPM_WORKSPACE_FILE);
  let source: string;
  try {
    source = await readFile(path, 'utf8');
  } catch (error) {
    if (isErrnoException(error) && error.code === 'ENOENT') return undefined;
    throw error;
  }

  const document = parseDocument(source);
  if (document.errors.length > 0) throw document.errors[0];
  const config: unknown = document.toJS();
  if (
    !isRecord(config) ||
    !Array.isArray(config.packages) ||
    !config.packages.every((pattern: unknown): pattern is string => typeof pattern === 'string')
  ) {
    throw new Error('The template has an invalid pnpm workspace list.');
  }
  return { document, packages: config.packages };
}

/** Expands the workspace patterns pnpm reads into folders with manifests. */
export async function workspaceDirectories(root: string): Promise<string[]> {
  const workspace = await readWorkspace(root);
  if (workspace === undefined) return [];
  return [
    ...new Set(
      globSync(
        workspace.packages.map((pattern) => `${pattern}/${PACKAGE_MANIFEST}`),
        { cwd: root },
      ).map((file) => posix.dirname(toPosix(file))),
    ),
  ].sort();
}

/** Keeps security settings and lists only workspaces left in the scaffold. */
export async function renderWorkspace(root: string): Promise<boolean> {
  const workspace = await readWorkspace(root);
  if (workspace === undefined) return false;
  const packages = workspace.packages.filter(
    (pattern) => globSync(`${pattern}/${PACKAGE_MANIFEST}`, { cwd: root }).length > 0,
  );
  if (packages.length === workspace.packages.length) return false;

  workspace.document.set('packages', packages);
  await writeFile(join(root, PNPM_WORKSPACE_FILE), workspace.document.toString(), 'utf8');
  return true;
}
