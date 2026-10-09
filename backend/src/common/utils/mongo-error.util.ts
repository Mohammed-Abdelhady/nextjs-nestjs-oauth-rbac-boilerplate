import { Error as MongooseError } from 'mongoose';
import {
  MongoNetworkError,
  MongoServerSelectionError,
  MongoServerError,
  MongoNotConnectedError,
  MongoTopologyClosedError,
  MongoWriteConcernError,
} from 'mongodb';
import {
  MONGO_DUPLICATE_KEY_CODE,
  MONGO_UNAVAILABLE_CODES,
  MONGO_TRANSIENT_TRANSACTION_LABEL,
} from '../constants/mongo-errors';
import { isUnknownTransactionOutcome } from '../exceptions/unknown-transaction-outcome.error';

/**
 * True for outages, unknown commits and exhausted write conflicts; ordinary
 * database rejections and application errors keep their own status.
 */
export function isDatabaseUnavailableError(exception: unknown): boolean {
  if (isUnknownTransactionOutcome(exception)) {
    return true;
  }
  if (
    typeof exception === 'object' &&
    exception !== null &&
    'errorLabels' in exception &&
    Array.isArray(exception.errorLabels) &&
    exception.errorLabels.includes(MONGO_TRANSIENT_TRANSACTION_LABEL)
  ) {
    return true;
  }
  if (
    exception instanceof MongoNetworkError ||
    exception instanceof MongoServerSelectionError ||
    exception instanceof MongoNotConnectedError ||
    exception instanceof MongoTopologyClosedError ||
    exception instanceof MongoWriteConcernError
  ) {
    return true;
  }
  if (exception instanceof MongoServerError) {
    return (
      typeof exception.code === 'number' &&
      MONGO_UNAVAILABLE_CODES.has(exception.code)
    );
  }
  if (exception instanceof MongooseError.MongooseServerSelectionError) {
    return true;
  }
  return (
    exception instanceof MongooseError &&
    /buffering timed out/i.test(exception.message)
  );
}

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
    exception.name === 'CastError'
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
  if (
    exception instanceof MongoServerError &&
    exception.code === MONGO_DUPLICATE_KEY_CODE
  ) {
    return true;
  }
  return (
    typeof exception === 'object' &&
    exception !== null &&
    'code' in exception &&
    exception.code === MONGO_DUPLICATE_KEY_CODE
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

export { describeDriverError, errorToken } from './describe-error.util';
