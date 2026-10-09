import type { AbortSignalPort, TimerPort } from '@app/native-auth';
import { DPOP_NONCE_HEADER, type Transport, type TransportRequest } from '@app/sdk';
import { HEADER, JSON_MEDIA_TYPE, REQUEST_DEADLINE_MESSAGE } from './constants';
import type { HttpApi } from './types/modules';

function requestHeaders(request: TransportRequest<AbortSignalPort>): Record<string, string> {
  const hasBody = request.body !== undefined;
  const headers: Record<string, string> = { [HEADER.ACCEPT]: JSON_MEDIA_TYPE };
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    const replacesContentType = name.toLowerCase() === HEADER.CONTENT_TYPE.toLowerCase();
    if (!hasBody || !replacesContentType) headers[name] = value;
  }
  if (hasBody) headers[HEADER.CONTENT_TYPE] = JSON_MEDIA_TYPE;
  return headers;
}

function parseJson(text: string): unknown {
  if (text.length === 0) return undefined;
  try {
    const value: unknown = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

/** Sends no cookies, and ends a request at the caller's abort or the deadline. */
export function createFetchTransport<TSignal>(
  http: HttpApi<TSignal>,
  timer: TimerPort,
  baseAddress: string,
  deadlineMs: number,
): Transport<AbortSignalPort> {
  return {
    async request(request) {
      const { signal } = request;
      const abort = http.createAbort();
      let pastDeadline = false;
      const onAbort = (): void => abort.abort();
      const cancelDeadline = timer.after(deadlineMs, () => {
        pastDeadline = true;
        abort.abort();
      });
      signal?.addEventListener('abort', onAbort);
      if (signal?.aborted) onAbort();
      try {
        // Concatenated after the origin: URL resolution could read a path as a new host.
        const response = await http.fetch(baseAddress + request.path, {
          method: request.method,
          headers: requestHeaders(request),
          body: request.body === undefined ? undefined : JSON.stringify(request.body),
          credentials: 'omit',
          signal: abort.signal,
        });
        // A device-bound session repeats its request with this nonce when the server asks for one.
        const nonce = response.headers.get(DPOP_NONCE_HEADER);
        return {
          status: response.status,
          body: parseJson(await response.text()),
          ...(nonce ? { headers: { [DPOP_NONCE_HEADER]: nonce } } : {}),
        };
      } catch (error) {
        throw pastDeadline ? new Error(REQUEST_DEADLINE_MESSAGE, { cause: error }) : error;
      } finally {
        cancelDeadline();
        signal?.removeEventListener('abort', onAbort);
      }
    },
  };
}
