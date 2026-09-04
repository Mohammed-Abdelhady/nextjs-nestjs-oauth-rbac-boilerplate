import { lastLines, run } from '../utils/exec.js';

export interface InstallResult {
  ok: boolean;
  reason?: string;
}

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

const SUPPORTED: PackageManager[] = ['npm'];

/** Reads the package manager that launched the CLI. Defaults to npm. */
export function detectPackageManager(
  userAgent = process.env.npm_config_user_agent,
): PackageManager {
  const name = userAgent?.split('/')[0];
  const known: PackageManager[] = ['npm', 'yarn', 'pnpm', 'bun'];
  return known.find((candidate) => candidate === name) ?? 'npm';
}

export function isSupported(manager: PackageManager): boolean {
  return SUPPORTED.includes(manager);
}

export async function installDependencies(root: string): Promise<InstallResult> {
  const result = await run('npm', ['install'], root);
  if (result.code === 0) return { ok: true };
  return { ok: false, reason: lastLines(result.stderr || result.stdout, 5) };
}
