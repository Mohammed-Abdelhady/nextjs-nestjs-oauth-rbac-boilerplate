import { TransportError, TRANSPORT_FAILURE } from '@app/sdk';
import type { AbortSignalPort } from '../types/auth';

export function raceWithAbort<T>(
  promise: Promise<T>,
  signal: AbortSignalPort | undefined,
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortedError());
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => {
      try {
        signal.removeEventListener('abort', onAbort);
      } catch {
        return;
      }
    };
    const onAbort = (): void => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(abortedError());
    };
    try {
      signal.addEventListener('abort', onAbort);
    } catch (error) {
      settled = true;
      reject(new TransportError(TRANSPORT_FAILURE.NO_RESPONSE, { cause: error }));
      return;
    }
    void promise.then(
      (value) => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(value);
      },
      (error: unknown) => {
        if (settled) return;
        settled = true;
        cleanup();
        reject(error);
      },
    );
  });
}

export function abortedError(): TransportError {
  return new TransportError(TRANSPORT_FAILURE.ABORTED);
}
