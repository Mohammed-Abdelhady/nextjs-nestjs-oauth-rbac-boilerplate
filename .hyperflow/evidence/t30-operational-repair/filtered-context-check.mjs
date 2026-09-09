import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import { createRequire } from 'node:module';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(directory, '../../..');
const require = createRequire(path.join(root, 'package.json'));
const ts = require('typescript');
const minimatch = require('minimatch');
const helper = await import(path.join(root, 'scripts/verify-docker.mjs'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');

// This checker supports the exclusion-only glob syntax used by this context.
// Reject new syntax instead of silently approximating Docker negation semantics.
function matcher(text) {
  const rules = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  for (const rule of rules)
    assert(/^[\w./*-]+$/.test(rule), `unsupported Docker ignore syntax: ${rule}`);
  return (file) => {
    const segments = file.split('/');
    return segments.some((_, index) =>
      rules.some((rule) => minimatch(segments.slice(0, index + 1).join('/'), rule, { dot: true })),
    );
  };
}

export function checkFilteredContext() {
  const startedAt = new Date().toISOString();
  const currentText = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8');
  const beforeText = fs.readFileSync(path.join(directory, 'dockerignore.before'), 'utf8');
  const ignored = matcher(currentText);
  for (const file of [
    'frontend/.env.local',
    'frontend/nested/private.key',
    'frontend/output/result.json',
    'frontend/e2e/.auth/state.json',
    'frontend/node_modules/a/index.ts',
  ])
    assert(ignored(file), file);
  const files = new Map();
  function collect(relative) {
    if (helper.excludedPath(relative) || ignored(relative)) return;
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = `${relative}/${entry.name}`;
      if (helper.excludedPath(name) || ignored(name)) continue;
      if (entry.isDirectory()) collect(name);
      else if (entry.isFile())
        files.set(path.join(root, name), fs.readFileSync(path.join(root, name)));
    }
  }
  collect('frontend');
  const beforeIgnored = matcher(beforeText);
  const baseline = new Map(
    [...files].filter(([file]) => !beforeIgnored(path.relative(root, file))),
  );
  const configPath = path.join(root, 'frontend/playwright.frontend.config.ts');
  const config = ts.parseConfigFileTextToJson(
    'tsconfig.json',
    files.get(path.join(root, 'frontend/tsconfig.json')).toString('utf8'),
  );
  assert(!config.error);
  const converted = ts.parseJsonConfigFileContent(
    config.config,
    {
      ...ts.sys,
      readDirectory: () => [...files.keys()].filter((file) => /\.(?:[cm]?ts|tsx)$/.test(file)),
    },
    path.join(root, 'frontend'),
  );
  assert.equal(converted.errors.length, 0);
  assert(
    config.config.include.some((pattern) => minimatch('playwright.frontend.config.ts', pattern)),
  );
  assert(
    !config.config.exclude.some((pattern) => minimatch('playwright.frontend.config.ts', pattern)),
  );

  function analyze(sourceFiles) {
    const directories = new Set();
    for (const file of sourceFiles.keys()) {
      for (let parent = path.dirname(file); parent.startsWith(root); parent = path.dirname(parent))
        directories.add(parent);
    }
    function allowed(file) {
      return !helper.prohibitedPath(path.relative(root, file));
    }
    function dependency(file) {
      return file.split(path.sep).includes('node_modules');
    }
    const host = ts.createCompilerHost(converted.options);
    host.fileExists = (file) =>
      allowed(file) && (sourceFiles.has(file) || (dependency(file) && ts.sys.fileExists(file)));
    host.readFile = (file) => {
      if (!allowed(file)) return undefined;
      if (sourceFiles.has(file)) return sourceFiles.get(file).toString('utf8');
      if (dependency(file)) return ts.sys.readFile(file);
      return undefined;
    };
    host.directoryExists = (file) =>
      allowed(file) &&
      (directories.has(file) || (dependency(file) && ts.sys.directoryExists(file)));
    host.getSourceFile = (file, languageVersion) => {
      const text = host.readFile(file);
      return text === undefined
        ? undefined
        : ts.createSourceFile(file, text, languageVersion, true);
    };
    const unresolved = [];
    let imports = 0;
    const generated = [];
    const cache = ts.createModuleResolutionCache(root, (file) => file, converted.options);
    for (const [file, text] of sourceFiles) {
      if (!/\.(?:[cm]?ts|tsx|jsx?)$/.test(file)) continue;
      for (const imported of ts.preProcessFile(text.toString('utf8'), true, true).importedFiles) {
        const name = imported.fileName;
        if (
          !(name.startsWith('.') || name.startsWith('@/')) ||
          /\.(?:css|scss|svg|png|jpg)$/.test(name)
        )
          continue;
        if (file.endsWith('/frontend/next-env.d.ts') && name === './.next/types/routes.d.ts') {
          generated.push({ file: path.relative(root, file), module: name });
          continue;
        }
        imports++;
        if (!ts.resolveModuleName(name, file, converted.options, host, cache).resolvedModule)
          unresolved.push({ file: path.relative(root, file), module: name });
      }
    }
    const program = ts.createProgram(
      [configPath],
      { ...converted.options, incremental: false, noEmit: true },
      host,
    );
    const diagnostics = program
      .getSemanticDiagnostics(program.getSourceFile(configPath))
      .map((d) => ({
        code: d.code,
        message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
      }));
    return {
      files: sourceFiles.size,
      imports,
      unresolved,
      generated,
      configDiagnostics: diagnostics,
    };
  }
  const before = analyze(baseline);
  const after = analyze(files);
  assert(
    before.configDiagnostics.some(
      (d) => d.code === 2307 && d.message.includes('./e2e/frontend-only/fixtures'),
    ),
  );
  assert(before.unresolved.some((d) => d.module === './e2e/frontend-only/fixtures'));
  assert.deepEqual(after.unresolved, []);
  assert.deepEqual(after.configDiagnostics, []);
  const capture = [...files].map(([file, contents]) => ({
    path: path.relative(root, file),
    sha256: sha256(contents),
  }));
  const changedDuringCheck = capture
    .filter((file) => sha256(fs.readFileSync(path.join(root, file.path))) !== file.sha256)
    .map((file) => file.path);
  assert.deepEqual(changedDuringCheck, [], 'selected frontend inputs changed during analysis');
  const result = {
    startedAt,
    completedAt: new Date().toISOString(),
    changedDuringCheck,
    node: process.version,
    typescript: ts.version,
    realDocker: false,
    before,
    after,
    capture,
    captureHash: sha256(JSON.stringify(capture)),
    limits:
      'Exclusion-only context model and installed dependency resolution; no full frontend typecheck or image build.',
  };
  fs.writeFileSync(
    path.join(directory, 'filtered-context-results.json'),
    JSON.stringify(result, null, 2),
  );
  return { before, after };
}

if (process.argv[1] && fs.realpathSync(process.argv[1]) === fileURLToPath(import.meta.url))
  console.log(JSON.stringify(checkFilteredContext(), null, 2));
