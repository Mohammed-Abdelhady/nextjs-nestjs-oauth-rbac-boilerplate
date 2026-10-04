// Keep generated projects on npm until their package-manager migration lands.
const NPM_OVERRIDES = {
  diff: '>=8.0.3',
  lodash: '^4.18.1',
  '@nestjs/platform-express': { multer: '2.4.0' },
};

export function npmCommands(content) {
  return content
    .replace(/(sh scripts\/lib\/require-package-manager\.sh) pnpm/g, '$1 npm')
    .replace(/pnpm -r --if-present run ([\w:-]+)/g, 'npm run $1 --workspaces --if-present')
    .replace(/pnpm --filter ([@\w/.-]+) run ([\w:-]+)/g, 'npm run $2 -w $1')
    .replace(/pnpm --filter ([@\w/.-]+) exec /g, 'npm exec --offline --workspace $1 -- ')
    .replace(/pnpm exec /g, 'npm exec --offline -- ')
    .replace(/pnpm install --frozen-lockfile/g, 'npm install')
    .replace(/pnpm run /g, 'npm run ');
}

export function npmTemplateContent(relativePath, bytes) {
  if (/(^|\/)package\.json$/.test(relativePath)) {
    const manifest = JSON.parse(bytes.toString('utf8'));
    delete manifest.packageManager;
    if (manifest.engines?.pnpm) {
      delete manifest.engines.pnpm;
      manifest.engines.npm = '>=10.9.0';
    }
    for (const section of [
      'dependencies',
      'devDependencies',
      'peerDependencies',
      'optionalDependencies',
    ]) {
      for (const [name, version] of Object.entries(manifest[section] ?? {})) {
        if (version === 'workspace:*') manifest[section][name] = '*';
      }
    }
    for (const [name, command] of Object.entries(manifest.scripts ?? {})) {
      manifest.scripts[name] = npmCommands(command);
    }
    if (relativePath === 'package.json') manifest.overrides = NPM_OVERRIDES;
    return Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`);
  }
  if (
    relativePath.startsWith('.husky/') ||
    relativePath === '.lintstagedrc.cjs' ||
    relativePath === 'scripts/lib/init-next-steps.js'
  ) {
    return Buffer.from(npmCommands(bytes.toString('utf8')));
  }
  return bytes;
}
