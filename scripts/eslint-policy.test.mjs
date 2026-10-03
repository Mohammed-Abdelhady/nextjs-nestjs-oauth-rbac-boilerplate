import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { workspacePolicyProblems } from './guardrails/workspace-policy.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const INVENTORY_OPTIONS = { filesystem: true };

test('every TypeScript file in present declared workspaces enforces the lint policy', async () => {
  assert.deepEqual(
    await workspacePolicyProblems(ROOT, { ...INVENTORY_OPTIONS, env: { PATH: '/dev/null' } }),
    [],
  );
});
