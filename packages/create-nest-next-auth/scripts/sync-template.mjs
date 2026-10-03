import { realpathSync } from 'node:fs';
// Copies the repository into template/ so the published package carries the
// boilerplate. Runs from the package's prebuild script. template/ is gitignored.
import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGE_DIR = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO_ROOT = dirname(dirname(PACKAGE_DIR));
const TEMPLATE_DIR = join(PACKAGE_DIR, 'template');
const MANIFEST_NAME = 'template.manifest.json';
// Mirrors TEMPLATE_IDENTITY_FILE in src/constants: the template's content
// hash, shipped next to template/ and recorded in generated projects.
const TEMPLATE_IDENTITY_FILE = 'template.identity.json';

// Directory names dropped wherever they appear.
const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.next',
  'out',
  'coverage',
  '.turbo',
  'output',
  'test-results',
  'playwright-report',
  'blob-report',
  '.auth',
  '.mongodb-binaries',
  'mongodb-memory-server',
  'mongodb-data',
  '.ssh',
  '.aws',
  '.kube',
  'ssl',
]);

// Paths dropped relative to the repository root. Maintainer tooling is not
// part of a generated project.
const EXCLUDED_PATHS = new Set([
  '.hyperflow',
  '.claude',
  '.codex',
  '.agents',
  '.kilocode',
  'openspec',
  'packages',
  'CLAUDE.md',
  'AGENTS.md',
  MANIFEST_NAME,
  join('.husky', '_'),
]);

const ENV_EXAMPLES = new Set([
  '.env.docker.example',
  join('backend', '.env.example'),
  join('frontend', '.env.example'),
]);

// npm drops these names from a published tarball, so they travel under a
// different name and the CLI renames them back while scaffolding.
const RENAMED_FILES = new Map([
  ['.gitignore', '_gitignore'],
  ['.npmrc', '_npmrc'],
  ['package-lock.json', '_package-lock.json'],
]);

export function isExcluded(relativePath, name, isDirectory) {
  if (name === '.git') return true;
  if (EXCLUDED_PATHS.has(relativePath)) return true;
  if (/(^|[\\/])\.config[\\/]gcloud($|[\\/])/.test(relativePath)) return true;
  if (name === '.env' || name.startsWith('.env.'))
    return isDirectory || !ENV_EXAMPLES.has(relativePath);
  if (/\.(pem|key|crt|tgz)$/i.test(name)) return true;
  if (isDirectory) return EXCLUDED_DIRS.has(name);
  if (name === '.DS_Store' || name.endsWith('.log') || name.endsWith('.tsbuildinfo')) return true;
  return false;
}

// One entry: shipped path, executable bit, content digest. Fields are NUL
// framed (a file name cannot contain NUL, so no name can forge a field or a
// second line) and the whole entry travels as one sorted line.
function entryLine(path, mode, bytes) {
  const digest = createHash('sha256').update(bytes).digest('hex');
  return `${path}\0${(mode & 0o111) === 0 ? '0' : '1'}\0${digest}`;
}

async function copyTree(sourceDir, targetDir, counters, hashes, shippedBy) {
  const entries = await readdir(sourceDir, { withFileTypes: true });
  await mkdir(targetDir, { recursive: true });

  for (const entry of entries) {
    const source = join(sourceDir, entry.name);
    const relativePath = relative(REPO_ROOT, source);
    if (isExcluded(relativePath, entry.name, entry.isDirectory())) continue;

    if (entry.isDirectory()) {
      await copyTree(source, join(targetDir, entry.name), counters, hashes, shippedBy);
      continue;
    }
    if (!entry.isFile()) continue;

    const targetName = RENAMED_FILES.get(entry.name) ?? entry.name;
    const shipped = relative(TEMPLATE_DIR, join(targetDir, targetName)).split(sep).join('/');
    const clash = shippedBy.get(shipped);
    if (clash !== undefined) {
      // The rename table could map two sources onto one shipped path; only one
      // of them would survive the copy, so the identity would lie.
      throw new Error(`Two template files ship as ${shipped}: ${clash} and ${relativePath}`);
    }
    shippedBy.set(shipped, relativePath);

    const stats = await stat(source);
    await cp(source, join(targetDir, targetName));
    counters.files += 1;
    counters.bytes += stats.size;
    hashes.push(entryLine(shipped, stats.mode, await readFile(source)));
  }
}

async function main() {
  // Both artifacts go together: a failed build must not leave an identity
  // beside a half-copied or stale template.
  await rm(TEMPLATE_DIR, { recursive: true, force: true });
  await rm(join(PACKAGE_DIR, TEMPLATE_IDENTITY_FILE), { force: true });
  const counters = { files: 0, bytes: 0 };
  const hashes = [];
  const shippedBy = new Map();
  await copyTree(REPO_ROOT, TEMPLATE_DIR, counters, hashes, shippedBy);

  const manifestPath = join(REPO_ROOT, MANIFEST_NAME);
  const manifestBytes = await readFile(manifestPath);
  const manifest = manifestBytes.toString('utf8');
  await writeFile(join(PACKAGE_DIR, MANIFEST_NAME), manifest, 'utf8');

  // One identity for what ships: every template file's shipped path,
  // executable bit and content digest, plus the manifest that decides what
  // those files become. Entries are NUL framed and sorted, a collision on a
  // shipped path is an error above, and any rename, mode change, added or
  // edited file, or manifest edit changes the digest. Two different templates
  // cannot share one identity.
  const manifestStats = await stat(manifestPath);
  hashes.push(entryLine(MANIFEST_NAME, manifestStats.mode, manifestBytes));
  hashes.sort();
  const identity = createHash('sha256')
    .update(`${hashes.join('\n')}\n`)
    .digest('hex');
  await writeFile(
    join(PACKAGE_DIR, TEMPLATE_IDENTITY_FILE),
    `${JSON.stringify({ sha256: identity }, null, 2)}\n`,
    'utf8',
  );

  const megabytes = (counters.bytes / 1024 / 1024).toFixed(1);
  console.log(`template: ${counters.files} files, ${megabytes} MB`);
  console.log(`manifest: ${Object.keys(JSON.parse(manifest).features).length} features`);
  console.log(`identity: sha256:${identity}`);
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
