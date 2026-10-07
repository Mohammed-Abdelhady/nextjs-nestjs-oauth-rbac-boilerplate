import type { AbortSignalPort } from '@app/native-auth';
import { API_PATHS, OAUTH_GRANT_TYPE, type Transport } from '@app/sdk';

export interface DebugTransport {
  transport: Transport<AbortSignalPort>;
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

/** Counts the refresh requests the engine sends, so the screen can show a refresh happened once. */
export function createDebugTransport(inner: Transport<AbortSignalPort>): DebugTransport {
  let refreshes = 0;
  return {
    transport: {
      request(request) {
        const route = request.path.split('?')[0];
        if (route === API_PATHS.oauth.token && isRefresh(request.body)) refreshes += 1;
        return inner.request(request);
      },
    },
    refreshRequests: () => refreshes,
  };
}
