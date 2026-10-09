import type { AbortSignalPort } from '@app/native-auth';
import { API_PATHS, OAUTH_GRANT_TYPE, type Transport } from '@app/sdk';

export interface DebugTransport {
  transport: Transport<AbortSignalPort>;
  /** Token requests sent for refresh, including nonce retries. */
  refreshTokenRequests(): number;
}

function isRefresh(body: unknown): boolean {
  return (
    typeof body === 'object' &&
    body !== null &&
    'grant_type' in body &&
    body.grant_type === OAUTH_GRANT_TYPE.REFRESH_TOKEN
  );
}

/** Counts each refresh token request sent, including a nonce challenge and its retry. */
export function createDebugTransport(inner: Transport<AbortSignalPort>): DebugTransport {
  let requests = 0;
  return {
    transport: {
      request(request) {
        const route = request.path.split('?')[0];
        if (route === API_PATHS.oauth.token && isRefresh(request.body)) requests += 1;
        return inner.request(request);
      },
    },
    refreshTokenRequests: () => requests,
  };
}
