import {
  spawnSync,
  type SpawnOptions,
  type SpawnSyncOptionsWithStringEncoding,
  type SpawnSyncReturns,
} from 'node:child_process';
import { GIT_PUSH_KILL_SIGNAL, GIT_PUSH_TIMEOUT_MS } from '../src/constants/index.js';

export function boundedGitPush(
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeout = GIT_PUSH_TIMEOUT_MS,
): SpawnSyncReturns<string> {
  const options: SpawnSyncOptionsWithStringEncoding & Pick<SpawnOptions, 'detached'> = {
    cwd,
    env: { ...env, npm_config_offline: 'true', npm_config_update_notifier: 'false' },
    encoding: 'utf8',
    detached: true,
    timeout,
    killSignal: GIT_PUSH_KILL_SIGNAL,
  };
  const result = spawnSync('git', ['push', ...args], options);
  if (result.error) {
    if (result.pid) {
      try {
        process.kill(-result.pid, GIT_PUSH_KILL_SIGNAL);
      } catch (error) {
        if (!(error instanceof Error) || !('code' in error) || error.code !== 'ESRCH') throw error;
      }
    }
    if ('code' in result.error && result.error.code === 'ETIMEDOUT')
      throw new Error(`Git push fixture timed out after ${timeout} ms.`);
    throw result.error;
  }
  return result;
}
