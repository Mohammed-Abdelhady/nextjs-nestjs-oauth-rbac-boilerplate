#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CommanderError } from 'commander';
import { main } from './cli.js';
import { packageRoot } from './paths.js';

async function readVersion(): Promise<string> {
  try {
    const raw = await readFile(join(packageRoot(), 'package.json'), 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const version = (parsed as { version?: unknown }).version;
    return typeof version === 'string' ? version : '0.0.0';
  } catch {
    return '0.0.0';
  }
}

try {
  process.exitCode = await main(process.argv.slice(2), await readVersion());
} catch (error) {
  if (error instanceof CommanderError) {
    process.exitCode = error.exitCode;
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
