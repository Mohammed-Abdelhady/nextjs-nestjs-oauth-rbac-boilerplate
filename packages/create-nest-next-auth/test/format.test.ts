import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatChangedFiles } from '../src/prune/format.js';

const roots: string[] = [];

async function tempRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cna-format-'));
  roots.push(root);
  return root;
}

afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});

describe('formatChangedFiles', () => {
  it('formats a changed file with the project prettier config', async () => {
    const root = await tempRoot();
    await writeFile(join(root, '.prettierrc'), JSON.stringify({ singleQuote: true }), 'utf8');
    await writeFile(join(root, 'a.ts'), 'const x = "hello"\n', 'utf8');

    const formatted = await formatChangedFiles(root, ['a.ts']);

    expect(formatted).toEqual(['a.ts']);
    expect(await readFile(join(root, 'a.ts'), 'utf8')).toBe("const x = 'hello';\n");
  });

  it('rethrows a prettier failure with the file path', async () => {
    const root = await tempRoot();
    await writeFile(join(root, 'bad.ts'), 'const x = {\n', 'utf8');

    await expect(formatChangedFiles(root, ['bad.ts'])).rejects.toThrow(/Could not format bad\.ts/);
  });
});
