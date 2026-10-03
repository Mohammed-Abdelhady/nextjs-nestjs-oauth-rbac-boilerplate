import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { INVALID_ACTIVATION_CODE_MESSAGE } from '../constants/auth-messages';

/**
 * The one answer every activation code step that cannot succeed returns.
 * Wrong code, no pending record, expired, exhausted, replayed, superseded and
 * an account collision all answer this, so no caller can tell them apart.
 */
export function activationCodeInvalid(): AppException {
  return new AppException(
    ErrorCode.ACTIVATION_CODE_INVALID,
    INVALID_ACTIVATION_CODE_MESSAGE,
    HttpStatus.BAD_REQUEST,
  );
}
