import { HttpStatus, Logger } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

const logger = new Logger('SessionAuthority');

export function throwIfAppException(error: unknown): void {
  if (error instanceof AppException) {
    throw error;
  }
}

export function asAuthorityUnavailable(error: unknown): never {
  throwIfAppException(error);
  const errorName = error instanceof Error ? error.name : 'UnknownError';
  const errorCode =
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (typeof error.code === 'number' || typeof error.code === 'string')
      ? error.code
      : 'unknown';
  logger.error(
    `Session authority operation failed: name=${errorName} code=${errorCode}`,
  );
  throw new AppException(
    ErrorCode.AUTHORITY_UNAVAILABLE,
    'Authentication authority is unavailable',
    HttpStatus.SERVICE_UNAVAILABLE,
  );
}
