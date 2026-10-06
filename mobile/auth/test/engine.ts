import { createAuthEngine as createEngine } from '../src';
import type { AuthConfiguration, AuthDependencies, AuthEngine, TimerPort } from '../src';
import { trackEngine } from './tracking';

export function createAuthEngine(
  configuration: AuthConfiguration,
  dependencies: AuthDependencies & { timer: TimerPort & { pending: number } },
): AuthEngine {
  return trackEngine(createEngine(configuration, dependencies), dependencies.timer);
}
