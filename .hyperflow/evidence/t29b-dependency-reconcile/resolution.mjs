import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2]);
const lock = JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
const importers = [
  'package.json',
  'backend/package.json',
  'frontend/package.json',
  'packages/create-nest-next-auth/package.json',
  'packages/create-nest-next-auth/src/flags/options.ts',
];

for (const importer of importers) {
  const require = createRequire(path.join(root, importer));
  const entry = require.resolve('commander');
  const manifest = JSON.parse(readFileSync(path.join(path.dirname(entry), 'package.json'), 'utf8'));
  const instance = new (require('commander').Command)();
  console.log(JSON.stringify({ importer, entry, version: manifest.version, argument: typeof instance.argument }));
}

for (const [location, pkg] of Object.entries(lock.packages)) {
  if (location.endsWith('/commander')) {
    console.log(JSON.stringify({ lockLocation: location, version: pkg.version, resolved: pkg.resolved }));
  }
}
