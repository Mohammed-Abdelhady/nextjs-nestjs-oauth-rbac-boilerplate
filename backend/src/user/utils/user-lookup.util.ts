import { HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

/**
 * Reject an identifier Mongo would choke on.
 *
 * @param id - Value taken from the request
 * @param message - Message returned to the caller
 * @throws AppException INVALID_INPUT
 */
export function assertValidObjectId(id: string, message: string): void {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppException(
      ErrorCode.INVALID_INPUT,
      message,
      HttpStatus.BAD_REQUEST,
    );
  }
}

export { assertActiveUser } from './account-lookup.util';
