import {
  AUTH_OPERATION,
  AUTH_REASON,
  BROWSER_AUTHORIZATION_TIMEOUT_MS,
  CRYPTO_DIGEST_TIMEOUT_MS,
  CRYPTO_RANDOM_TIMEOUT_MS,
  OAUTH_STATE_BYTES,
  PKCE_VERIFIER_BYTES,
  PORT_OPERATION,
  SESSION_STATUS,
} from './constants';
import { withPortDeadline } from './deadlines';
import { base64UrlEncode, pkceChallenge } from './encoding';
import { AuthPortError } from './errors';
import { makeRecord } from './persistence';
import type { AuthRuntime } from './runtime';
import type { AuthTransaction, PendingAuthRecord } from './types/record';
import type { SessionStatus, SignInOutcome } from './types/auth';

export type SignInPreparation =
  | { kind: 'ready'; transaction: AuthTransaction; challenge: string }
  | { kind: 'outcome'; outcome: SignInOutcome };

export async function prepareSignIn(
  runtime: AuthRuntime,
  epoch: number,
  previousStatus: SessionStatus,
): Promise<SignInPreparation> {
  if (!runtime.isEpochCurrent(epoch)) return failed({ kind: 'signedOut' });
  const installDigest = runtime.installDigest;
  if (!installDigest) {
    runtime.setState(previousStatus, AUTH_OPERATION.NONE);
    return failed({ kind: 'storageFailure', error: new Error('Install identity is unavailable') });
  }

  let verifier: string;
  let state: string;
  let challenge: string;
  let operationId: string;
  try {
    const verifierBytes = await withPortDeadline(
      runtime.dependencies.timer,
      CRYPTO_RANDOM_TIMEOUT_MS,
      () => runtime.dependencies.crypto.randomBytes(PKCE_VERIFIER_BYTES),
      PORT_OPERATION.CRYPTO_RANDOM_BYTES,
    );
    const stateBytes = await withPortDeadline(
      runtime.dependencies.timer,
      CRYPTO_RANDOM_TIMEOUT_MS,
      () => runtime.dependencies.crypto.randomBytes(OAUTH_STATE_BYTES),
      PORT_OPERATION.CRYPTO_RANDOM_BYTES,
    );
    const operationBytes = await withPortDeadline(
      runtime.dependencies.timer,
      CRYPTO_RANDOM_TIMEOUT_MS,
      () => runtime.dependencies.crypto.randomBytes(OAUTH_STATE_BYTES),
      PORT_OPERATION.CRYPTO_RANDOM_BYTES,
    );
    if (
      verifierBytes.length !== PKCE_VERIFIER_BYTES ||
      stateBytes.length < OAUTH_STATE_BYTES ||
      operationBytes.length < OAUTH_STATE_BYTES
    ) {
      throw new TypeError('The crypto port returned the wrong number of random bytes');
    }
    verifier = base64UrlEncode(verifierBytes);
    state = base64UrlEncode(stateBytes);
    operationId = base64UrlEncode(operationBytes);
    challenge = await withPortDeadline(
      runtime.dependencies.timer,
      CRYPTO_DIGEST_TIMEOUT_MS,
      () => pkceChallenge(verifier, runtime.dependencies.crypto),
      PORT_OPERATION.CRYPTO_SHA256,
    );
  } catch (error) {
    if (!runtime.isEpochCurrent(epoch)) return failed({ kind: 'signedOut' });
    runtime.setState(previousStatus, AUTH_OPERATION.NONE);
    return failed({ kind: 'cryptoFailure', error: asError(error) });
  }
  if (!runtime.isEpochCurrent(epoch)) return failed({ kind: 'signedOut' });

  let transaction: AuthTransaction;
  let baseRecord: PendingAuthRecord;
  try {
    baseRecord = makeRecord(runtime.config, installDigest);
    const createdAt = runtime.wallTime();
    transaction = {
      verifier,
      state,
      returnAddress: runtime.config.redirectUri,
      createdAt,
      expiresAt: createdAt + BROWSER_AUTHORIZATION_TIMEOUT_MS,
      operationId: `${runtime.nextOperationId()}-${operationId}`,
    };
  } catch (error) {
    if (!runtime.isEpochCurrent(epoch)) return failed({ kind: 'signedOut' });
    runtime.setState(previousStatus, AUTH_OPERATION.NONE);
    return failed(
      error instanceof AuthPortError
        ? { kind: 'clockFailure', error }
        : { kind: 'cryptoFailure', error: asError(error) },
    );
  }

  const saved: PendingAuthRecord = { ...baseRecord, transaction };
  try {
    const written = await runtime.replaceRecord(saved, epoch, { kind: 'delete' });
    if (!written) return failed({ kind: 'signedOut' });
  } catch (error) {
    if (!runtime.isEpochCurrent(epoch)) return failed({ kind: 'signedOut' });
    runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
      reason: AUTH_REASON.STORAGE_FAILURE,
    });
    return failed({ kind: 'storageFailure', error: asError(error) });
  }
  return { kind: 'ready', transaction, challenge };
}

function failed(outcome: SignInOutcome): SignInPreparation {
  return { kind: 'outcome', outcome };
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
