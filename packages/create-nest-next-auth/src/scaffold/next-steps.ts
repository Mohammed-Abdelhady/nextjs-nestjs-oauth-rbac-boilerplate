import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { INSTALL_COMMAND } from '../constants/index.js';
import { isRecord } from '../manifest/read.js';
import type { Manifest } from '../types.js';

export interface NextStepsInput {
  directoryLabel: string;
  installed: boolean;
  docker: boolean;
  scripts: WorkspaceStartScripts;
}

export interface WorkspaceStartScripts {
  backend: string;
  frontend: string;
}

async function workspaceScript(
  root: string,
  workspace: string,
  preferred: string,
  fallback: string,
): Promise<string> {
  const path = join(root, workspace, 'package.json');
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    const scripts = isRecord(parsed) && isRecord(parsed.scripts) ? parsed.scripts : {};
    const name = preferred in scripts ? preferred : fallback;
    return `pnpm --filter ${workspace} run ${name}`;
  } catch {
    return `pnpm --filter ${workspace} run ${preferred}`;
  }
}

/** The commands that start each workspace, read from the generated scripts. */
export async function readWorkspaceStartScripts(root: string): Promise<WorkspaceStartScripts> {
  return {
    backend: await workspaceScript(root, 'backend', 'start:dev', 'start'),
    frontend: await workspaceScript(root, 'frontend', 'dev', 'start'),
  };
}

/** The commands printed after a successful scaffold. */
export function buildNextSteps(input: NextStepsInput): string[] {
  const steps = [`cd ${input.directoryLabel}`];
  if (!input.installed) steps.push(INSTALL_COMMAND);
  if (input.docker) {
    steps.push('cp .env.docker.example .env.docker', 'docker compose --env-file .env.docker up -d');
    return steps;
  }
  steps.push(
    'cp backend/.env.example backend/.env',
    'cp frontend/.env.example frontend/.env.local',
    '# Start a single-node replica set (sign-in uses transactions):',
    'mkdir -p ./mongodb-data',
    'mongod --replSet rs0 --dbpath ./mongodb-data',
    '# leave mongod running, then in a second terminal:',
    'mongosh --eval "rs.initiate()"',
    '# set MONGO_URI with replicaSet=rs0 in backend/.env, then:',
    input.scripts.backend,
    input.scripts.frontend,
  );
  return steps;
}

/** Docs worth reading for the features that were kept. */
export function buildDocLinks(manifest: Manifest, selected: string[]): string[] {
  const links = ['README.md', 'docs/README.md'];
  for (const id of selected) {
    links.push(...(manifest.features[id]?.docs ?? []));
  }
  return [...new Set(links)];
}
