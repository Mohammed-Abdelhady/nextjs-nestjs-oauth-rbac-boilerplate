// Copies the repository into template/ so the published package carries the
// boilerplate. Runs from the package's prebuild script. template/ is gitignored.
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = dirname(dirname(PACKAGE_DIR));
const TEMPLATE_DIR = join(PACKAGE_DIR, 'template');
const MANIFEST_NAME = 'template.manifest.json';

// Directory names dropped wherever they appear.
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'out',
  'coverage',
  '.turbo',
]);

// Paths dropped relative to the repository root. Maintainer tooling and the
// publish workflow are not part of a generated project.
const EXCLUDED_PATHS = new Set([
  '.hyperflow',
  '.claude',
  '.kilocode',
  'openspec',
  'packages',
  'CLAUDE.md',
  'AGENTS.md',
  MANIFEST_NAME,
  join('.github', 'workflows', 'publish-cli.yml'),
  join('.husky', '_'),
]);

// npm drops these names from a published tarball, so they travel under a
// different name and the CLI renames them back while scaffolding.
const RENAMED_FILES = new Map([
  ['.gitignore', '_gitignore'],
  ['.npmrc', '_npmrc'],
  ['package-lock.json', '_package-lock.json'],
]);

function isExcluded(relativePath, name, isDirectory) {
  if (EXCLUDED_PATHS.has(relativePath)) return true;
  if (isDirectory) return EXCLUDED_DIRS.has(name);
  if (name === '.DS_Store' || name.endsWith('.log') || name.endsWith('.tsbuildinfo')) return true;
  if (name === '.env' || (name.startsWith('.env.') && !name.endsWith('.example'))) return true;
  return false;
}

async function copyTree(sourceDir, targetDir, counters) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await mkdir(targetDir, { recursive: true });

  for (const entry of entries) {
    const source = join(sourceDir, entry.name);
    const relativePath = relative(REPO_ROOT, source);
    if (isExcluded(relativePath, entry.name, entry.isDirectory())) continue;

    if (entry.isDirectory()) {
      await copyTree(source, join(targetDir, entry.name), counters);
      continue;
    }
    if (!entry.isFile()) continue;

    const targetName = RENAMED_FILES.get(entry.name) ?? entry.name;
    await cp(source, join(targetDir, targetName));
    counters.files += 1;
    counters.bytes += (await stat(source)).size;
  }
}

async function main() {
  await rm(TEMPLATE_DIR, { recursive: true, force: true });
  const counters = { files: 0, bytes: 0 };
  await copyTree(REPO_ROOT, TEMPLATE_DIR, counters);

  const manifest = await readFile(join(REPO_ROOT, MANIFEST_NAME), 'utf8');
  await writeFile(join(PACKAGE_DIR, MANIFEST_NAME), manifest, 'utf8');

  const megabytes = (counters.bytes / 1024 / 1024).toFixed(1);
  console.log(`template: ${counters.files} files, ${megabytes} MB`);
  console.log(`manifest: ${Object.keys(JSON.parse(manifest).features).length} features`);
}

await main();
