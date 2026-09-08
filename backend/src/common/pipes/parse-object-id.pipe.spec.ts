import { HttpStatus } from '@nestjs/common';
import { ParseObjectIdPipe } from './parse-object-id.pipe';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';

describe('ParseObjectIdPipe', () => {
  let pipe: ParseObjectIdPipe;

  beforeEach(() => {
    pipe = new ParseObjectIdPipe();
  });

  it('returns valid 24-character hexadecimal string unchanged', () => {
    const validId = '507f1f77bcf86cd799439011';
    expect(pipe.transform(validId)).toBe(validId);
  });

  it('accepts uppercase hex characters', () => {
    const uppercaseId = '507F1F77BCF86CD799439011';
    expect(pipe.transform(uppercaseId)).toBe(uppercaseId);
  });

  it('throws AppException 400 INVALID_INPUT for short string', () => {
    expect(() => pipe.transform('123')).toThrow(AppException);
    try {
      pipe.transform('123');
    } catch (error) {
      const appError = error as AppException;
      expect(appError.getStatus()).toBe(HttpStatus.BAD_REQUEST);
      expect(appError.getCode()).toBe(ErrorCode.INVALID_INPUT);
    }
  });

  it('throws AppException 400 INVALID_INPUT for 24-character non-hex string', () => {
    expect(() => pipe.transform('507f1f77bcf86cd79943901z')).toThrow(
      AppException,
    );
  });

  it('throws AppException 400 INVALID_INPUT for 23-character string', () => {
    expect(() => pipe.transform('507f1f77bcf86cd79943901')).toThrow(
      AppException,
    );
  });

  it('throws AppException 400 INVALID_INPUT for 25-character string', () => {
    expect(() => pipe.transform('507f1f77bcf86cd7994390111')).toThrow(
      AppException,
    );
  });

  it('throws AppException 400 INVALID_INPUT for 12-byte string allowed by BSON', () => {
    expect(() => pipe.transform('123456789012')).toThrow(AppException);
  });

  it('throws AppException 400 INVALID_INPUT for non-string input', () => {
    const notAString = 12345 as unknown as string;
    expect(() => pipe.transform(notAString)).toThrow(AppException);
  });
});
