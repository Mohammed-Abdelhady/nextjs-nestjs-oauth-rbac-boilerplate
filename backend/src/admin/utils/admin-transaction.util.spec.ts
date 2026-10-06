import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { UnknownTransactionOutcomeError } from '../../common/exceptions/unknown-transaction-outcome.error';
import { rethrowOrUnavailable } from './admin-transaction.util';

describe('admin transaction error mapping', () => {
  it('maps an unknown commit to the shared 503 outcome code', () => {
    let caught: unknown;
    try {
      rethrowOrUnavailable(
        new UnknownTransactionOutcomeError(new Error('commit answer lost')),
      );
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(AppException);
    if (!(caught instanceof AppException)) {
      throw new Error('Expected the authority error mapping');
    }
    expect(caught.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(caught.getCode()).toBe(ErrorCode.TRANSACTION_OUTCOME_UNKNOWN);
  });
});
