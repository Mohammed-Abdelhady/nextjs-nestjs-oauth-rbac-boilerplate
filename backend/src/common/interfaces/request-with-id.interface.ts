import { Request } from 'express';

/**
 * Request carrying the correlation id set by RequestIdMiddleware.
 * The id is present on every request that went through the middleware.
 */
export interface RequestWithId extends Request {
  requestId?: string;
}
