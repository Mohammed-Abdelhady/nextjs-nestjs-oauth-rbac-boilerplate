import { ApiError, API_PATHS, TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import type { ApiClient, TokenSet } from '@app/sdk';
import { OAUTH_REFRESH_TIMEOUT_MS, SESSION_STATUS } from './constants';
import { withNetworkDeadline } from './deadlines';
import { requestWithDpopNonceRetry } from './dpop-requests';
import type { AuthRuntime } from './runtime';
import type { AbortSignalPort } from './types/auth';
import type { RuntimeTokens } from './types/record';
import { isKnownNonRotatingFailure } from './refresh-helpers';

export function requestRefreshTokens(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  tokens: RuntimeTokens,
  epoch: number,
  onLateSuccess: (tokens: TokenSet) => void,
): Promise<TokenSet> {
  return withNetworkDeadline(
    runtime.dependencies.timer,
    OAUTH_REFRESH_TIMEOUT_MS,
    (signal) =>
      tokens.proofKeyThumbprint === undefined
        ? client.oauth.refresh(
            { refreshToken: tokens.refreshToken, clientId: runtime.config.clientId },
            { signal },
          )
        : refreshBoundToken(runtime, client, tokens, epoch, signal),
    onLateSuccess,
  );
}

async function refreshBoundToken(
  runtime: AuthRuntime,
  client: ApiClient<AbortSignalPort>,
  tokens: RuntimeTokens,
  epoch: number,
  signal: AbortSignalPort,
): Promise<TokenSet> {
  let nonce: string | undefined;
  const send = async (): Promise<TokenSet> => {
    const result = await requestWithDpopNonceRetry(
      {
        ...runtime.dependencies,
        serverBaseAddress: runtime.config.serverBaseAddress,
        method: 'POST',
        path: API_PATHS.oauth.token,
        token: tokens.refreshToken,
        expectedThumbprint: tokens.proofKeyThumbprint,
        nonce,
        signal,
        mayRetryChallenge: () => runtime.isEpochCurrent(epoch) && !runtime.disposed,
        onNonce: (value) => {
          nonce = value;
        },
      },
      ({ headers, signal: requestSignal }) =>
        client.oauth.refresh(
          { refreshToken: tokens.refreshToken, clientId: runtime.config.clientId },
          { headers, signal: requestSignal },
        ),
    );
    return result.value;
  };
  try {
    return await send();
  } catch (error) {
    if (!mayRetryUnknownRefresh(runtime, epoch, signal, error)) throw error;
    return send();
  }
}

function mayRetryUnknownRefresh(
  runtime: AuthRuntime,
  epoch: number,
  signal: AbortSignalPort,
  error: unknown,
): boolean {
  if (
    !runtime.isEpochCurrent(epoch) ||
    runtime.disposed ||
    signal.aborted ||
    runtime.snapshot.status !== SESSION_STATUS.SIGNED_IN ||
    isKnownNonRotatingFailure(error)
  ) {
    return false;
  }
  if (error instanceof TransportError) return error.reason === TRANSPORT_FAILURE.NO_RESPONSE;
  return error instanceof ApiError && error.status >= 500 && error.status <= 599;
}
