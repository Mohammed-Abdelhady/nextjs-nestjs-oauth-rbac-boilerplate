import { cp, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const frontend = fileURLToPath(new URL('../..', import.meta.url));
const standalone = join(frontend, '.next/standalone');
const server = existsSync(join(standalone, 'frontend/server.js'))
  ? join(standalone, 'frontend/server.js')
  : join(standalone, 'server.js');

await access(server);
// Next's standalone output omits static assets; serve the same build's assets.
await cp(join(frontend, 'public'), join(dirname(server), 'public'), { recursive: true });
await cp(join(frontend, '.next/static'), join(dirname(server), '.next/static'), {
  recursive: true,
});
process.env.PORT = '3107';
process.env.HOSTNAME = '127.0.0.1';
await import(pathToFileURL(server).href);
