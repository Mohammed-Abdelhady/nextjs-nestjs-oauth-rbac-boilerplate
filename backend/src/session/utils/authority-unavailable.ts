import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

export function throwIfAppException(error: unknown): void {
  if (error instanceof AppException) {
    throw error;
  }
}

export function asAuthorityUnavailable(error: unknown): never {
  throwIfAppException(error);
  throw new AppException(
    ErrorCode.AUTHORITY_UNAVAILABLE,
    'Authentication authority is unavailable',
    HttpStatus.SERVICE_UNAVAILABLE,
    {
      cause: error instanceof Error ? error.message : String(error),
    },
  );
}
