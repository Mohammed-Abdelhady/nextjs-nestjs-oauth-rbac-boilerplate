import { ApiError } from './errors';
import type { Transport, TransportRequest, TransportResponse } from './transport';

export function respond(
  status: number,
  body?: unknown,
  headers?: Readonly<Record<string, string>>,
): TransportResponse {
  return { status, body, ...(headers === undefined ? {} : { headers }) };
}

export function thrownBy(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error('expected a throw');
}

export function apiErrorFrom(run: () => unknown): ApiError {
  const error = thrownBy(run);
  if (error instanceof ApiError) return error;
  throw error;
}

export interface FakeTransport extends Transport {
  sent: TransportRequest[];
}

/** Records what the client sends and answers with one hand-written response. */
export function answering(status: number, body?: unknown): FakeTransport {
  const sent: TransportRequest[] = [];
  return {
    sent,
    request: (request) => {
      sent.push(request);
      return Promise.resolve(respond(status, body));
    },
  };
}

export function rejecting(error: unknown): FakeTransport {
  const sent: TransportRequest[] = [];
  return {
    sent,
    request: (request) => {
      sent.push(request);
      return Promise.reject(error);
    },
  };
}
