import {
  TRANSPORT_FAILURE,
  TRANSPORT_FAILURE_MESSAGE,
  type HttpMethod,
  type TransportFailure,
} from './constants';

/** What the client reads of an AbortSignal: this package compiles without DOM or Node types. */
export interface TransportSignal {
  readonly aborted: boolean;
}

export interface TransportRequest<TSignal extends TransportSignal = TransportSignal> {
  method: HttpMethod;
  path: string;
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
 * encoding and decoding. It resolves for every HTTP status and rejects only
 * when no response was received.
 */
export interface Transport<TSignal extends TransportSignal = TransportSignal> {
  request(request: TransportRequest<TSignal>): Promise<TransportResponse>;
}

/** No response was received. `reason` tells an aborted call from a failed one. */
export class TransportError extends Error {
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

/**
 * Whatever a transport rejects with surfaces as a `TransportError`. The signal
 * decides the reason: an aborted call is never reported as a network failure.
 */
export function toTransportError(error: unknown, signal?: TransportSignal): TransportError {
  const reason = signal?.aborted ? TRANSPORT_FAILURE.ABORTED : TRANSPORT_FAILURE.NO_RESPONSE;
  if (error instanceof TransportError && (!signal?.aborted || error.reason === reason)) {
    return error;
  }
  return new TransportError(reason, { cause: error });
}
