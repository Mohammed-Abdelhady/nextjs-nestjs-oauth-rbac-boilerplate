import { AUTH_OPERATION, AUTH_REASON, SESSION_STATUS } from './constants';
import { DeviceKeyAuthError } from './errors';
import type { AuthRuntime } from './runtime';
import type { SessionAuthRecord } from './types/record';

export async function settleDeviceKeyRefreshFailure(
  runtime: AuthRuntime,
  record: SessionAuthRecord,
  epoch: number,
  error: DeviceKeyAuthError,
): Promise<void> {
  const written = await runtime.replaceRecord(record, epoch).then(
    (result) => result,
    () => false,
  );
  if (!runtime.isEpochCurrent(epoch)) return;
  if (error.reason === 'unavailable') {
    runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.NONE, {
      profile: runtime.snapshot.profile,
      ...(written ? {} : { warning: 'storageBlocked' }),
    });
    return;
  }
  runtime.tokens = undefined;
  runtime.setState(SESSION_STATUS.REAUTH_REQUIRED, AUTH_OPERATION.NONE, {
    reason: AUTH_REASON.DEVICE_KEY_INVALIDATED,
  });
}
