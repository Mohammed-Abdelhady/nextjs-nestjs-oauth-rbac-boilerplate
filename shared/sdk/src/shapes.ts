import { HTTP_STATUS_OK } from './constants';
import {
  isJsonObject,
  malformedResponse,
  unwrapEnvelope,
  unwrapEnvelopeBody,
  type JsonObject,
} from './envelope';
import type { TransportResponse } from './transport';

/** `value` as an object, or an `ApiError` naming what was expected there. */
export function requireObject(value: unknown, name: string, status: number): JsonObject {
  if (!isJsonObject(value)) {
    throw malformedResponse(status, `The response is malformed: ${name} is not an object`);
  }
  return value;
}

export function requireArray(value: unknown, name: string, status: number): unknown[] {
  if (!Array.isArray(value)) {
    throw malformedResponse(status, `The response is malformed: ${name} is not a list`);
  }
  return value;
}

/** `data` of a success envelope, refused unless it is an object. */
export function unwrapObject<T extends object>(response: TransportResponse): T {
  return requireObject(unwrapEnvelope<unknown>(response), 'data', response.status) as T;
}

/** The same for a body whose response already passed as successful. */
export function unwrapObjectBody<T extends object>(body: unknown): T {
  return requireObject(unwrapEnvelopeBody<unknown>(body), 'data', HTTP_STATUS_OK) as T;
}
