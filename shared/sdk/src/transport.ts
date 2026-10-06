import {
  TRANSPORT_FAILURE,
  TRANSPORT_FAILURE_MESSAGE,
  type HttpMethod,
  type TransportFailure,
} from './constants';
import { isSdkError, SdkError } from './errors';

/** What the client reads of an AbortSignal: this package compiles without DOM or Node types. */
export interface TransportSignal {
  readonly aborted: boolean;
}

export interface TransportRequest<TSignal extends TransportSignal = TransportSignal> {
  method: HttpMethod;
  path: string;
  /** Extra request headers. A transport must forward them; its JSON content type takes precedence. */
  headers?: Readonly<Record<string, string>>;
  /** A JSON value. The transport serialises it and sets `Content-Type: application/json`. */
  body?: unknown;
  /** The caller's signal, handed through untouched for the transport to cancel on. */
  signal?: TSignal;
}

export interface TransportResponse {
  status: number;
  /** The parsed JSON, or `undefined` when the response has no JSON body. */
  body: unknown;
}

/**
 * The port every platform implements. It owns the base URL, credentials, JSON
 * encoding and decoding. It forwards request headers without allowing them to
 * override the content type it sets for JSON bodies. It resolves every HTTP
 * status, rejects transport failures without a response, and may throw
 * `SdkError` for typed failures.
 */
export interface Transport<TSignal extends TransportSignal = TransportSignal> {
  request(request: TransportRequest<TSignal>): Promise<TransportResponse>;
}

/** No response was received. `reason` tells an aborted call from a failed one. */
export class TransportError extends SdkError {
  readonly reason: TransportFailure;

  constructor(
    reason: TransportFailure = TRANSPORT_FAILURE.NO_RESPONSE,
    options?: { cause?: unknown },
  ) {
    super(TRANSPORT_FAILURE_MESSAGE[reason], options);
    this.name = 'TransportError';
    this.reason = reason;
  }
}

export function isTransportError(error: unknown): error is TransportError {
  return (
    isSdkError(error) &&
    'reason' in error &&
    (error.reason === TRANSPORT_FAILURE.ABORTED || error.reason === TRANSPORT_FAILURE.NO_RESPONSE)
  );
}

/**
 * Converts an untyped transport rejection to `TransportError`. Callers must
 * preserve `SdkError` instances before using this helper.
 */
export function toTransportError(error: unknown, signal?: TransportSignal): TransportError {
  const reason = signal?.aborted ? TRANSPORT_FAILURE.ABORTED : TRANSPORT_FAILURE.NO_RESPONSE;
  if (isTransportError(error) && (!signal?.aborted || error.reason === reason)) {
    return error;
  }
  return new TransportError(reason, { cause: error });
}
