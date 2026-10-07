import {
  AuthPortError,
  CredentialStoreError,
  type RefreshOutcome,
  type RestoreOutcome,
  type SignInOutcome,
  type SignOutOutcome,
} from '@app/native-auth';
import { ApiError, OAuthError, TransportError } from '@app/sdk';

export type EngineOutcome = RestoreOutcome | SignInOutcome | SignOutOutcome | RefreshOutcome;

const UNKNOWN_ERROR = 'unknown';

/** Engine and server identifiers, shown as they are: codes, not copy. */
export function describeError(error: unknown): string {
  if (error instanceof ApiError) return `${error.name} ${error.status} ${error.code}`;
  if (error instanceof OAuthError) return `${error.name} ${error.status} ${error.error}`;
  if (error instanceof TransportError) return `${error.name} ${error.reason}`;
  if (error instanceof CredentialStoreError) {
    return `${error.name} ${error.operation} ${error.condition}`;
  }
  if (error instanceof AuthPortError) return `${error.name} ${error.operation} ${error.reason}`;
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return UNKNOWN_ERROR;
}

function outcomeDetail(outcome: EngineOutcome): string | undefined {
  if ('reason' in outcome) return outcome.reason;
  if ('status' in outcome) return outcome.status;
  if ('revocation' in outcome && outcome.revocation !== undefined) {
    return outcome.error === undefined
      ? outcome.revocation
      : `${outcome.revocation}, ${describeError(outcome.error)}`;
  }
  if ('error' in outcome && outcome.error !== undefined) {
    return typeof outcome.error === 'string' ? outcome.error : describeError(outcome.error);
  }
  return undefined;
}

export function describeOutcome(outcome: EngineOutcome): string {
  const detail = outcomeDetail(outcome);
  return detail === undefined ? outcome.kind : `${outcome.kind} (${detail})`;
}
