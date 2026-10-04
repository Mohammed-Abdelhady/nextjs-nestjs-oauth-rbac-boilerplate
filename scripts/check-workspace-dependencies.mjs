import { existsSync, globSync, readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { packageImports } from './lib/package-imports.mjs';

const BUILT_INS = new Set(builtinModules.map((name) => name.replace(/^node:/, '')));
const SOURCE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const EXCLUDED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  '.next',
  'out',
  'coverage',
  'template',
  'test-results',
  'playwright-report',
  '.auth',
  '.mongodb-binaries',
  'mongodb-data',
]);
const DEPENDENCY_SECTIONS = [
  'dependencies',
  'devDependencies',
  'peerDependencies',
  'optionalDependencies',
];

function json(file) {
  return JSON.parse(readFileSync(file, 'utf8'));
}

function workspaceDirectories(root, patterns) {
  const manifests = patterns.flatMap((pattern) => globSync(`${pattern}/package.json`, { cwd: root }));
  return [...new Set(manifests)]
    .map((file) => join(root, file, '..'))
    .sort();
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = join(directory, entry.name);
    if (entry.name.startsWith('.env') || EXCLUDED_DIRECTORIES.has(entry.name)) return [];
    if (entry.isDirectory()) return sourceFiles(file);
    return entry.isFile() && SOURCE_EXTENSION.test(entry.name) ? [file] : [];
  });
}

function aliases(directory, manifest) {
  const config = join(directory, 'tsconfig.json');
  const paths = existsSync(config) ? json(config).compilerOptions?.paths ?? {} : {};
  return [...Object.keys(paths), ...Object.keys(manifest.imports ?? {})];
}

function isAlias(specifier, patterns) {
  return patterns.some((pattern) => {
    const star = pattern.indexOf('*');
    if (star === -1) return specifier === pattern;
    return (
      specifier.startsWith(pattern.slice(0, star)) &&
      specifier.endsWith(pattern.slice(star + 1))
    );
  });
}

export function checkWorkspaceDependencies(root) {
  const manifest = json(join(root, 'package.json'));
  const patterns = Array.isArray(manifest.workspaces)
    ? manifest.workspaces
    : manifest.workspaces?.packages ?? [];
  const findings = [];
  for (const directory of workspaceDirectories(root, patterns)) {
    const workspace = json(join(directory, 'package.json'));
    const declared = new Set(
      DEPENDENCY_SECTIONS.flatMap((section) => Object.keys(workspace[section] ?? {})),
    );
    const localAliases = aliases(directory, workspace);
    for (const file of sourceFiles(directory).sort()) {
      const missing = new Set();
      for (const specifier of packageImports(readFileSync(file, 'utf8'))) {
        if (
          /^(?:\.|\/|node:)/.test(specifier) ||
          BUILT_INS.has(specifier) ||
          isAlias(specifier, localAliases)
        ) continue;
        const name = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0];
        if (name !== workspace.name && !declared.has(name)) missing.add(name);
      }
      for (const name of [...missing].sort()) {
        findings.push({ file: relative(root, file).split('\\').join('/'), package: name });
      }
    }
  }
  return findings;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const findings = checkWorkspaceDependencies(process.cwd());
  for (const finding of findings)
    console.error(`${finding.file}: undeclared dependency ${finding.package}`);
  process.exitCode = findings.length ? 1 : 0;
}
