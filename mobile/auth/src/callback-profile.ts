import { AUTH_OPERATION, AUTH_REASON, PROFILE_READ_TIMEOUT_MS, SESSION_STATUS } from './constants';
import { withNetworkDeadline } from './deadlines';
import { apiFailureOutcome } from './callback-outcomes';
import type { ApiClient } from '@app/sdk';
import type { AuthRuntime } from './runtime';
import type { AbortSignalPort, SignInOutcome } from './types/auth';

export async function readExchangedProfile(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  refreshToken: string,
  lineageId: string,
  proofKeyThumbprint: string | undefined,
  epoch: number,
  revokeLateToken: (
    token: string,
    lineageId?: string,
    proofKeyThumbprint?: string,
  ) => Promise<void>,
): Promise<SignInOutcome> {
  try {
    const profile = await withNetworkDeadline(
      runtime.dependencies.timer,
      PROFILE_READ_TIMEOUT_MS,
      (signal) => client.profile.get({ signal }),
    );
    if (!runtime.isEpochCurrent(epoch)) {
      if (runtime.disposed) await revokeLateToken(refreshToken, lineageId, proofKeyThumbprint);
      return { kind: 'signedOut' };
    }
    runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.NONE, { profile });
    const savedProfile = runtime.snapshot.profile;
    return savedProfile ? { kind: 'signedIn', profile: savedProfile } : { kind: 'signedOut' };
  } catch (error) {
    if (!runtime.isEpochCurrent(epoch)) {
      if (runtime.disposed) await revokeLateToken(refreshToken, lineageId, proofKeyThumbprint);
      return { kind: 'signedOut' };
    }
    const tokenToRevoke = runtime.tokens?.refreshToken ?? refreshToken;
    const endedEpoch = runtime.bumpEpoch();
    runtime.tokens = undefined;
    await runtime.deleteRecord(endedEpoch).catch(() => false);
    if (!runtime.isEpochCurrent(endedEpoch)) return { kind: 'signedOut' };
    await revokeLateToken(tokenToRevoke, lineageId, proofKeyThumbprint);
    if (!runtime.isEpochCurrent(endedEpoch)) return { kind: 'signedOut' };
    runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE, {
      reason: AUTH_REASON.PROFILE_FAILURE,
    });
    return apiFailureOutcome(error);
  }
}
