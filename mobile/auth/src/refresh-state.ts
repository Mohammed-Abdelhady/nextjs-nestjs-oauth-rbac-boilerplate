import { AUTH_OPERATION, SESSION_STATUS } from './constants';
import type { AuthRuntime } from './runtime';

export function finishRefresh(runtime: AuthRuntime, warning = false): void {
  runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.NONE, {
    profile: runtime.snapshot.profile,
    ...(warning ? { warning: 'storageBlocked' as const } : {}),
  });
}
