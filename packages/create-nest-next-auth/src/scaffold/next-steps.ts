import type { Manifest } from '../types.js';

export interface NextStepsInput {
  directoryLabel: string;
  installed: boolean;
}

/** The commands printed after a successful scaffold. */
export function buildNextSteps(input: NextStepsInput): string[] {
  const steps = [`cd ${input.directoryLabel}`];
  if (!input.installed) steps.push('npm install');
  steps.push(
    'cp backend/.env.example backend/.env',
    'cp .env.docker.example .env.docker',
    'docker compose up -d',
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
