import { readFileSync } from 'node:fs';
import { parseDocument } from 'yaml';
import { isRecord } from '../src/manifest/read.js';

export const PNPM_SETUP_ACTION = 'pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413';
export const PNPM_SETUP_WITH = {
  version: '12.6.0',
  run_install: false,
  cache: true,
  cache_dependency_path: 'pnpm-lock.yaml',
};

export function readWorkflow(path: URL | string): Record<string, unknown> {
  const document = parseDocument(readFileSync(path, 'utf8'), { uniqueKeys: true });
  if (document.errors.length) throw new Error(document.errors.join('\n'));
  const value: unknown = document.toJS();
  if (!isRecord(value)) throw new Error('Workflow must be a mapping');
  return value;
}

export function jobsOf(workflow: Record<string, unknown>): Record<string, unknown> {
  if (!isRecord(workflow.jobs)) throw new Error('Workflow jobs must be a mapping');
  return workflow.jobs;
}

export function stepsOf(value: unknown): Record<string, unknown>[] {
  if (!isRecord(value) || !Array.isArray(value.steps)) throw new Error('Job steps missing');
  return value.steps.map((step: unknown) => {
    if (!isRecord(step)) throw new Error('Step must be a mapping');
    return step;
  });
}
