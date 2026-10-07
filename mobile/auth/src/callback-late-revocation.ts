import type { ApiClient } from '@app/sdk';
import { revokeQuietly } from './revocation';
import { settleDisposedToken } from './refresh-dispose';
import type { AuthRuntime } from './runtime';
import type { AbortSignalPort } from './types/auth';

export function createLateTokenRevoker(
  runtime: AuthRuntime,
  revocationClient: ApiClient<AbortSignalPort>,
  installDigest: string,
): (token: string, lineageId?: string, proofKeyThumbprint?: string) => Promise<void> {
  let revokedToken: string | undefined;
  let revocation: Promise<void> | undefined;
  return (token, lineageId, proofKeyThumbprint) => {
    if (revokedToken === token && revocation) return revocation;
    revokedToken = token;
    revocation = runtime.disposed
      ? settleDisposedToken(
          runtime,
          revocationClient,
          installDigest,
          lineageId,
          token,
          undefined,
          proofKeyThumbprint,
        )
      : revokeQuietly(
          revocationClient,
          runtime.dependencies,
          token,
          runtime.config.clientId,
          proofKeyThumbprint === undefined
            ? undefined
            : {
                serverBaseAddress: runtime.config.serverBaseAddress,
                proofKeyThumbprint,
              },
        );
    return revocation;
  };
}
