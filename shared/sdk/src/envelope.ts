import { ErrorCode, extractFieldErrors, getStatusErrorCode } from '@app/core/errors';
import { HTTP_STATUS_OK, SUCCESS_STATUS_MAX, SUCCESS_STATUS_MIN } from './constants';
import { ApiError, OAuthError } from './errors';
import type { TransportResponse } from './transport';

export type JsonObject = Record<string, unknown>;

export function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isSuccessStatus(status: number): boolean {
  return status >= SUCCESS_STATUS_MIN && status <= SUCCESS_STATUS_MAX;
}

/** A response that arrived in a shape this client cannot use. */
export function malformedResponse(status: number, problem: string): ApiError {
  return new ApiError({ status, code: ErrorCode.UNKNOWN_ERROR, message: problem });
}

/** `{ success: false, error: { ... } }`, the shape the global filter writes. */
function readErrorEnvelope(body: unknown): JsonObject | undefined {
  if (!isJsonObject(body) || body.success !== false || !isJsonObject(body.error)) {
    return undefined;
  }
  return body;
}

/** What to say when the body itself carries no message. */
function describeFailure(body: unknown, status: number): string {
  if (!isSuccessStatus(status)) {
    return `Request failed with status ${status}`;
  }
  return body === undefined
    ? 'The response has no JSON body'
    : 'The response body is not a success or error envelope';
}

function toApiError(body: unknown, status: number): ApiError {
  const envelope = readErrorEnvelope(body);
  const error = isJsonObject(envelope?.error) ? envelope.error : undefined;
  const code = nonEmptyString(error?.code) ?? getStatusErrorCode(status);

  return new ApiError({
    status,
    code,
    message: nonEmptyString(error?.message) ?? describeFailure(body, status),
    fields: code === ErrorCode.VALIDATION_ERROR ? extractFieldErrors(error?.details) : undefined,
    requestId: nonEmptyString(envelope?.requestId),
  });
}

function readEnvelope<T>(body: unknown, status: number): T {
  if (isSuccessStatus(status) && isJsonObject(body) && body.success === true) {
    return body.data as T;
  }
  throw toApiError(body, status);
}

/**
 * Returns `data` from a success envelope and throws an `ApiError` for anything
 * else. `data` is returned as it came: use the shape readers for a route whose
 * payload has a known shape.
 */
export function unwrapEnvelope<T>(response: TransportResponse): T {
  return readEnvelope<T>(response.body, response.status);
}

/** The same unwrap for a body whose response already passed as successful. */
export function unwrapEnvelopeBody<T>(body: unknown): T {
  return readEnvelope<T>(body, HTTP_STATUS_OK);
}

/**
 * For the raw OAuth routes. Returns the body on success, throws `OAuthError`
 * for `{ error }`, and falls back to `ApiError` when the failure is the
 * application envelope (throttling) or carries no JSON.
 */
export function unwrapOAuth<T extends object>(response: TransportResponse): T {
  const { status, body } = response;
  const succeeded = isSuccessStatus(status);

  if (succeeded && isJsonObject(body)) {
    return body as T;
  }
  if (succeeded) {
    throw malformedResponse(status, 'The OAuth response is not a JSON object');
  }
  const oauthError = isJsonObject(body) ? nonEmptyString(body.error) : undefined;
  if (oauthError !== undefined) {
    const errorDescription = isJsonObject(body)
      ? nonEmptyString(body.error_description)
      : undefined;
    throw new OAuthError({ status, error: oauthError, errorDescription });
  }
  throw toApiError(body, status);
}
