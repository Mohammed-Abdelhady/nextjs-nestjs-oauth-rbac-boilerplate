import { spawn } from 'node:child_process';

const MAX_OUTPUT = 1024 * 1024;

export function cleanEnvironment(home, dockerHost) {
  const environment = { PATH: process.env.PATH, HOME: home, LANG: 'C.UTF-8', CI: 'true' };
  if (dockerHost) environment.DOCKER_HOST = dockerHost;
  return environment;
}

export function command(executable, args, { cwd, env, timeout = 30_000, signal, label } = {}) {
  return new Promise((resolveCommand, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
      detached: process.platform !== 'win32',
    });
    let stdout = '';
    let stderr = '';
    let bytes = 0;
    let failure;
    let killTimer;
    function kill(processSignal) {
      try {
        if (process.platform === 'win32') child.kill(processSignal);
        else process.kill(-child.pid, processSignal);
      } catch (error) {
        if (error.code !== 'ESRCH') failure ??= error;
      }
    }
    function stop(reason) {
      if (failure) return;
      failure = new Error(reason);
      kill('SIGTERM');
      killTimer = setTimeout(() => kill('SIGKILL'), 2000);
    }
    const timer = setTimeout(() => stop('command timed out'), timeout);
    const abort = () => stop('cancelled');
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    child.stdout.on('data', (chunk) => {
      bytes += chunk.length;
      if (bytes > MAX_OUTPUT) stop('command output limit exceeded');
      else stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr = `${stderr}${chunk.toString()}`.slice(-400);
    });
    child.on('error', (error) => {
      failure = new Error(`cannot start ${executable}: ${error.code}`);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      clearTimeout(killTimer);
      signal?.removeEventListener('abort', abort);
      if (failure) reject(failure);
      else if (code !== 0) {
        const safeArgs = args
          .filter((arg) => !/(secret|password|token|key)/i.test(String(arg)))
          .map((arg) => {
            const text = String(arg);
            return text.length > 48 ? `${text.slice(0, 32)}…` : text;
          })
          .join(' ');
        const redacted = stderr.replace(/[A-Za-z0-9+/=_-]{24,}/g, '[redacted]').trim();
        reject(
          new Error(
            `${label ?? executable}: ${executable} ${safeArgs} exited ${code}${
              redacted ? `; ${redacted}` : ''
            }`,
          ),
        );
      } else resolveCommand(stdout.trim());
    });
  });
}
