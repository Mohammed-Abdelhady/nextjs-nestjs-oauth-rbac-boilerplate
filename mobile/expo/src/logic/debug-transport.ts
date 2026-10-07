import type { AbortSignalPort } from '@app/native-auth';
import { API_PATHS, OAUTH_GRANT_TYPE, type Transport } from '@app/sdk';
import { HTTP_STATUS_UNAUTHORIZED } from '../constants';

export interface DebugTransport {
  transport: Transport<AbortSignalPort>;
  /** Answers the next API request with a local 401, so the engine has to refresh. */
  expireNextRequest(): void;
  /** Refresh requests that were sent to the server. */
  refreshRequests(): number;
}

function isRefresh(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'grant_type' in body &&
    body.grant_type === OAUTH_GRANT_TYPE.REFRESH_TOKEN
  );
}

/**
 * The engine has no call that asks for a refresh. This debug wrapper stands in
 * for an expired access token: the 401 is local, the refresh it causes is real.
 */
export function createDebugTransport(inner: Transport<AbortSignalPort>): DebugTransport {
  let expireNext = false;
  let refreshes = 0;
  return {
    transport: {
      request(request) {
        const route = request.path.split('?')[0];
        if (route === API_PATHS.oauth.token || route === API_PATHS.oauth.revoke) {
          if (route === API_PATHS.oauth.token && isRefresh(request.body)) refreshes += 1;
          return inner.request(request);
        }
        if (!expireNext) return inner.request(request);
        expireNext = false;
        return Promise.resolve({ status: HTTP_STATUS_UNAUTHORIZED, body: undefined });
      },
    },
    expireNextRequest() {
      expireNext = true;
    },
    refreshRequests: () => refreshes,
  };
}
