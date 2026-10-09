import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    combinationRoot: string;
    pnpmStore: string;
  }
}

export default function setup(project: TestProject): () => void {
  const root = mkdtempSync(join(tmpdir(), 'cna-pnpm-combinations-'));
  project.provide('combinationRoot', root);
  project.provide('pnpmStore', join(root, 'store'));
  return () => rmSync(root, { recursive: true, force: true });
}
