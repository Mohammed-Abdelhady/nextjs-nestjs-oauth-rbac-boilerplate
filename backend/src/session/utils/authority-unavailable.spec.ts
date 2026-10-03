import { Logger } from '@nestjs/common';
import { MongoServerError } from 'mongodb';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { AppException } from '../../common/exceptions/app.exception';
import { asAuthorityUnavailable } from './authority-unavailable';

describe('authority unavailable errors', () => {
  it('keeps the driver cause out of client response details', () => {
    let failure: unknown;
    try {
      asAuthorityUnavailable(
        new Error(
          'connect failed to db.internal:27017 duplicate member@example.test',
        ),
      );
    } catch (error) {
      failure = error;
    }

    const response =
      failure instanceof AppException
        ? { code: failure.getCode(), details: failure.getDetails() }
        : null;

    expect(response).toEqual({
      code: ErrorCode.AUTHORITY_UNAVAILABLE,
      details: undefined,
    });
  });

  it('logs only the error name and code for a duplicate session token hash', () => {
    const duplicateHash =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    const driverError = new MongoServerError({
      message: `E11000 duplicate key error collection: sessions index: tokenHash_unique dup key: { tokenHash: "${duplicateHash}" }`,
      code: 11000,
    });
    const logger = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);

    try {
      expect(() => asAuthorityUnavailable(driverError)).toThrow(AppException);
      expect(logger.mock.calls).toEqual([
        [
          'Session authority operation failed: name=MongoServerError code=11000',
        ],
      ]);
    } finally {
      logger.mockRestore();
    }
  });
});
