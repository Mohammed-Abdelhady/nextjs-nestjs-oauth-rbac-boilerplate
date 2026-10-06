import { OAuthError } from '@app/sdk';
import type { ApiClient } from '@app/sdk';
import {
  AUTH_OPERATION,
  AUTH_REASON,
  CRYPTO_RANDOM_TIMEOUT_MS,
  OAUTH_EXCHANGE_TIMEOUT_MS,
  PORT_OPERATION,
  PROFILE_READ_TIMEOUT_MS,
  SESSION_LINEAGE_BYTES,
  SESSION_STATUS,
} from './constants';
import { oauthFailureReason } from './failure';
import { parseCallback, parseUri } from './redirect';
import { constantTimeEqual, transactionExpired } from './persistence';
import { withNetworkDeadline, withPortDeadline } from './deadlines';
import { base64UrlEncode } from './encoding';
import { revokeQuietly } from './revocation';
import { settleDisposedToken } from './refresh-dispose';
import { apiFailureOutcome, asError, exchangeFailureOutcome } from './callback-outcomes';
import type { AuthRuntime } from './runtime';
import type { PendingAuthRecord, SessionAuthRecord, AuthTransaction } from './types/record';
import type {
  AbortSignalPort,
  InvalidCallbackReason,
  SessionStatus,
  SignInOutcome,
} from './types/auth';
import type { CallbackResult } from './redirect';

export interface CallbackProcessor {
  processAddress(address: string, onAccepted?: () => void): Promise<CallbackProcessingOutcome>;
  discardTransaction(
    transaction: AuthTransaction,
    epoch: number,
  ): Promise<{ kind: 'discarded' | 'stale' } | { kind: 'storageFailure'; error: Error }>;
  restorePriorState(status: SessionStatus): void;
}

export type CallbackProcessingOutcome = SignInOutcome | { kind: 'ignored' };

export function callbackRejectionReason(
  address: string,
  transaction: AuthTransaction,
): InvalidCallbackReason {
  const expected = parseUri(transaction.returnAddress);
  if (!expected) return 'malformed';
  const callback = parseCallback(address, expected);
  if (callback.kind === 'invalid') return callback.reason;
  return constantTimeEqual(callback.state, transaction.state)
    ? 'invalidParameters'
    : 'stateMismatch';
}

export function createCallbackProcessor(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  revocationClient: ApiClient<AbortSignalPort> = client,
): CallbackProcessor {
  const processing = new Map<string, Promise<CallbackProcessingOutcome>>();

  const processAddress = async (
    address: string,
    onAccepted?: () => void,
  ): Promise<CallbackProcessingOutcome> => {
    const transaction = runtime.record?.transaction;
    if (!transaction) return { kind: 'signedOut' };
    const callback = acceptedCallback(address, transaction);
    if (!callback) return { kind: 'ignored' };
    const inProgress = processing.get(transaction.operationId);
    if (inProgress) return inProgress;
    const task = consumeAndExchange(callback, transaction, runtime.epoch, onAccepted);
    processing.set(transaction.operationId, task);
    try {
      return await task;
    } finally {
      processing.delete(transaction.operationId);
    }
  };

  async function consumeAndExchange(
    callback: Extract<CallbackResult, { kind: 'code' | 'error' }>,
    transaction: AuthTransaction,
    epoch: number,
    onAccepted?: () => void,
  ): Promise<CallbackProcessingOutcome> {
    const previousStatus = runtime.snapshot.status;
    const record = runtime.record;
    if (
      !runtime.isEpochCurrent(epoch) ||
      !record?.transaction ||
      record.transaction.operationId !== transaction.operationId
    ) {
      return { kind: 'signedOut' };
    }
    onAccepted?.();
    let wallTime: number;
    try {
      wallTime = runtime.wallTime();
    } catch (error) {
      const discarded = await discardTransaction(transaction, epoch);
      if (discarded.kind === 'stale') return { kind: 'signedOut' };
      if (discarded.kind === 'storageFailure')
        return { kind: 'storageFailure', error: discarded.error };
      restorePriorState(previousStatus);
      return { kind: 'clockFailure', error: asError(error) };
    }
    if (transactionExpired(transaction, wallTime)) {
      const discarded = await discardTransaction(transaction, epoch);
      if (discarded.kind === 'stale') return { kind: 'signedOut' };
      if (discarded.kind === 'storageFailure')
        return { kind: 'storageFailure', error: discarded.error };
      restorePriorState(previousStatus);
      return { kind: 'expired' };
    }
    const consumed: PendingAuthRecord = {
      schemaVersion: record.schemaVersion,
      serverBaseAddress: record.serverBaseAddress,
      environment: record.environment,
      clientId: record.clientId,
      installDigest: record.installDigest,
      authorizationOperationId: transaction.operationId,
    };
    try {
      const written = await runtime.replaceRecord(consumed, epoch);
      if (!written || !runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
      runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.STORAGE_FAILURE,
      });
      return { kind: 'storageFailure', error: asError(error) };
    }
    if (callback.kind === 'error') {
      await runtime.deleteRecord(epoch).catch(() => false);
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
      runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.AUTHORIZATION_DENIED,
      });
      return { kind: 'authorizationDenied', error: callback.error };
    }
    runtime.setState(previousStatus, AUTH_OPERATION.EXCHANGING);
    return exchangeCode(callback.code, transaction, consumed, epoch);
  }

  async function exchangeCode(
    code: string,
    transaction: AuthTransaction,
    consumed: PendingAuthRecord,
    epoch: number,
  ): Promise<SignInOutcome> {
    let revokedToken: string | undefined;
    let revocation: Promise<void> | undefined;
    const revokeLateToken = (token: string, lineageId?: string): Promise<void> => {
      if (revokedToken === token && revocation) return revocation;
      revokedToken = token;
      revocation = runtime.disposed
        ? settleDisposedToken(runtime, revocationClient, consumed.installDigest, lineageId, token)
        : revokeQuietly(revocationClient, runtime.dependencies, token, runtime.config.clientId);
      return revocation;
    };
    let lineageId: string;
    try {
      const lineageBytes = await withPortDeadline(
        runtime.dependencies.timer,
        CRYPTO_RANDOM_TIMEOUT_MS,
        () => runtime.dependencies.crypto.randomBytes(SESSION_LINEAGE_BYTES),
        PORT_OPERATION.CRYPTO_RANDOM_BYTES,
      );
      if (lineageBytes.length !== SESSION_LINEAGE_BYTES)
        throw new TypeError('Session lineage randomness has an unexpected length');
      lineageId = base64UrlEncode(lineageBytes);
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
      runtime.tokens = undefined;
      await runtime.deleteRecord(epoch).catch(() => false);
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
      runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE);
      return { kind: 'cryptoFailure', error: asError(error) };
    }
    try {
      const tokens = await withNetworkDeadline(
        runtime.dependencies.timer,
        OAUTH_EXCHANGE_TIMEOUT_MS,
        (signal) =>
          client.oauth.exchangeCode(
            {
              code,
              codeVerifier: transaction.verifier,
              redirectUri: transaction.returnAddress,
              clientId: runtime.config.clientId,
            },
            { signal },
          ),
        (lateTokens) => {
          void revokeLateToken(lateTokens.refreshToken, lineageId).catch(() => undefined);
        },
      );
      if (!runtime.isEpochCurrent(epoch)) {
        await revokeLateToken(tokens.refreshToken, lineageId);
        return { kind: 'signedOut' };
      }
      const sentAt = runtime.lastOAuthTokenSentAt ?? runtime.monotonicTime();
      runtime.installTokens(
        tokens.accessToken,
        tokens.refreshToken,
        sentAt,
        tokens.expiresIn,
        lineageId,
      );
      const tokenRecord: SessionAuthRecord = {
        schemaVersion: consumed.schemaVersion,
        serverBaseAddress: consumed.serverBaseAddress,
        environment: consumed.environment,
        clientId: consumed.clientId,
        installDigest: consumed.installDigest,
        lineageId,
        tokens: { refreshToken: tokens.refreshToken },
      };
      try {
        const written = await runtime.replaceRecord(
          tokenRecord,
          epoch,
          { kind: 'replace', record: tokenRecord },
          {
            kind: 'session',
            installDigest: consumed.installDigest,
            refreshToken: tokens.refreshToken,
            lineageId,
          },
        );
        if (!written) {
          await revokeLateToken(tokens.refreshToken, lineageId);
          return { kind: 'signedOut' };
        }
      } catch (error) {
        if (!runtime.isEpochCurrent(epoch)) {
          if (runtime.disposed) await revokeLateToken(tokens.refreshToken, lineageId);
          return { kind: 'signedOut' };
        }
        runtime.tokens = undefined;
        await revokeLateToken(tokens.refreshToken, lineageId);
        runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
          reason: AUTH_REASON.STORAGE_FAILURE,
        });
        return { kind: 'storageFailure', error: asError(error) };
      }
      return await readProfile(tokens.refreshToken, lineageId, epoch, revokeLateToken);
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
      runtime.tokens = undefined;
      await runtime.deleteRecord(epoch).catch(() => false);
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'signedOut' };
      const outcome = exchangeFailureOutcome(error);
      const reason = error instanceof OAuthError ? oauthFailureReason(error) : undefined;
      runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE, reason ? { reason } : {});
      return outcome;
    }
  }

  async function readProfile(
    refreshToken: string,
    lineageId: string,
    epoch: number,
    revokeLateToken: (token: string, lineageId?: string) => Promise<void>,
  ): Promise<SignInOutcome> {
    try {
      const profile = await withNetworkDeadline(
        runtime.dependencies.timer,
        PROFILE_READ_TIMEOUT_MS,
        (signal) => client.profile.get({ signal }),
      );
      if (!runtime.isEpochCurrent(epoch)) {
        if (runtime.disposed) await revokeLateToken(refreshToken, lineageId);
        return { kind: 'signedOut' };
      }
      runtime.setState(SESSION_STATUS.SIGNED_IN, AUTH_OPERATION.NONE, { profile });
      const savedProfile = runtime.snapshot.profile;
      return savedProfile ? { kind: 'signedIn', profile: savedProfile } : { kind: 'signedOut' };
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) {
        if (runtime.disposed) await revokeLateToken(refreshToken, lineageId);
        return { kind: 'signedOut' };
      }
      const tokenToRevoke = runtime.tokens?.refreshToken ?? refreshToken;
      const endedEpoch = runtime.bumpEpoch();
      runtime.tokens = undefined;
      await runtime.deleteRecord(endedEpoch).catch(() => false);
      if (!runtime.isEpochCurrent(endedEpoch)) return { kind: 'signedOut' };
      await revokeLateToken(tokenToRevoke, lineageId);
      if (!runtime.isEpochCurrent(endedEpoch)) return { kind: 'signedOut' };
      runtime.setState(SESSION_STATUS.SIGNED_OUT, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.PROFILE_FAILURE,
      });
      return apiFailureOutcome(error);
    }
  }

  async function discardTransaction(
    transaction: AuthTransaction,
    epoch: number,
  ): Promise<{ kind: 'discarded' | 'stale' } | { kind: 'storageFailure'; error: Error }> {
    const record = runtime.record;
    if (!record?.transaction || record.transaction.operationId !== transaction.operationId) {
      return runtime.isEpochCurrent(epoch) ? { kind: 'discarded' } : { kind: 'stale' };
    }
    try {
      const deleted = await runtime.deleteRecordGuarded(epoch, {
        kind: 'authorization',
        operationId: transaction.operationId,
      });
      return deleted ? { kind: 'discarded' } : { kind: 'stale' };
    } catch (error) {
      if (!runtime.isEpochCurrent(epoch)) return { kind: 'stale' };
      runtime.setState(SESSION_STATUS.STORAGE_BLOCKED, AUTH_OPERATION.NONE, {
        reason: AUTH_REASON.STORAGE_FAILURE,
      });
      return {
        kind: 'storageFailure',
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  function restorePriorState(status: SessionStatus): void {
    const nextStatus = status === SESSION_STATUS.RESTORING ? SESSION_STATUS.SIGNED_OUT : status;
    runtime.setState(nextStatus, AUTH_OPERATION.NONE);
  }

  return { processAddress, discardTransaction, restorePriorState };
}

function acceptedCallback(
  address: string,
  transaction: AuthTransaction,
): Extract<CallbackResult, { kind: 'code' | 'error' }> | undefined {
  const expected = parseUri(transaction.returnAddress);
  if (!expected) return undefined;
  const callback = parseCallback(address, expected);
  if (callback.kind === 'invalid' || !constantTimeEqual(callback.state, transaction.state)) {
    return undefined;
  }
  return callback;
}
