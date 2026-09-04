import { Error as MongooseError } from 'mongoose';
import { MongoServerError } from 'mongodb';

/**
 * Checks whether an exception is a Mongoose CastError.
 *
 * @param exception - Unknown exception
 * @returns True when the error is a CastError
 */
export function isCastError(
  exception: unknown,
): exception is MongooseError.CastError {
  if (exception instanceof MongooseError.CastError) {
    return true;
  }
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'name' in exception &&
    (exception as { name: unknown }).name === 'CastError'
  );
}

/**
 * Checks whether an exception is a MongoDB duplicate key error (code 11000).
 *
 * @param exception - Unknown exception
 * @returns True when the error is code 11000
 */
export function isMongoDuplicateKeyError(
  exception: unknown,
): exception is MongoServerError {
  if (exception instanceof MongoServerError && exception.code === 11000) {
    return true;
  }
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    (exception as { code: unknown }).code === 11000
  );
}

/**
 * Checks whether a duplicate key error targets the email field.
 *
 * @param exception - Unknown exception
 * @returns True when the duplicate key is email
 */
export function isDuplicateEmailError(exception: unknown): boolean {
  if (typeof exception !== 'object' || exception === null) {
    return false;
  }

  const err = exception as {
    keyPattern?: Record<string, unknown>;
    keyValue?: Record<string, unknown>;
    message?: unknown;
  };

  if (
    err.keyPattern &&
    Object.prototype.hasOwnProperty.call(err.keyPattern, 'email')
  ) {
    return true;
  }

  if (
    err.keyValue &&
    Object.prototype.hasOwnProperty.call(err.keyValue, 'email')
  ) {
    return true;
  }

  if (typeof err.message === 'string' && err.message.includes('email')) {
    return true;
  }

  return false;
}
