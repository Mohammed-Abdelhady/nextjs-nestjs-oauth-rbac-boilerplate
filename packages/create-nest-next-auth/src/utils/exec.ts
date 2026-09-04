import { spawn } from 'node:child_process';

export interface RunResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs a command without a shell and collects its output. Never throws. */
export function run(command: string, args: string[], cwd: string): Promise<RunResult> {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString();
    });
    child.on('error', (error: Error) => {
      resolve({ code: 127, stdout, stderr: error.message });
    });
    child.on('close', (code: number | null) => {
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}

export function lastLines(text: string, count: number): string {
  return text.trimEnd().split('\n').slice(-count).join('\n');
}
