import type { Response } from 'supertest';
import { AppException } from '../../src/common/exceptions/app.exception';
import { RouteIdPipe } from '../../src/common/pipes/route-id.pipe';

/** Everything a client can tell apart in a refusal. */
export interface RefusalAnswer {
  status: number;
  success: unknown;
  code: unknown;
  message: unknown;
  bodyKeys: string[];
  errorKeys: string[];
}

interface RefusalBody {
  success?: unknown;
  error?: { code?: unknown; message?: unknown };
}

export function refusalAnswer(response: Response): RefusalAnswer {
  const body = response.body as RefusalBody;
  return {
    status: response.status,
    success: body.success,
    code: body.error?.code,
    message: body.error?.message,
    bodyKeys: Object.keys(body).sort(),
    errorKeys: Object.keys(body.error ?? {}).sort(),
  };
}

/** A refusal in the envelope every error leaves in. */
export function refusal(
  status: number,
  code: string,
  message: string,
  errorKeys: string[] = ['code', 'message'],
): RefusalAnswer {
  return {
    status,
    success: false,
    code,
    message,
    bodyKeys: ['error', 'requestId', 'success'],
    errorKeys,
  };
}

/** What a route answered for an id no database could have issued. */
export const MALFORMED_ID_ANSWER = refusal(
  400,
  'INVALID_INPUT',
  'Invalid identifier format',
);

/** Well-formed on MongoDB and naming nothing. */
export const ABSENT_ID = '507f1f77bcf86cd799439011';

/** Path segments as they are sent, each malformed on MongoDB. */
export const MALFORMED_IDS: ReadonlyArray<readonly [string, string]> = [
  ['a word', 'not-an-id'],
  ['one character short', '507f1f77bcf86cd79943901'],
  ['one character long', '507f1f77bcf86cd7994390111'],
  ['the right length with a letter past f', '507f1f77bcf86cd79943901z'],
  ["the other database's id", '018f4d2e-7b1a-7c3d-9e2f-0a1b2c3d4e5f'],
  ['a query operator', '%7B%22%24ne%22%3Anull%7D'],
  ['three hundred characters', 'a'.repeat(300)],
];

/** How a route's id check refuses, as a service-level case sees it. */
export const ROUTE_ID_REFUSAL = { code: 'INVALID_INPUT', status: 400 };

/** The id a route's check let through, or the code and status it refused with. */
export function routeIdAnswer(pipe: RouteIdPipe, id: string): unknown {
  try {
    return pipe.transform(id);
  } catch (error) {
    if (!(error instanceof AppException)) throw error;
    return { code: error.getCode(), status: error.getStatus() };
  }
}
