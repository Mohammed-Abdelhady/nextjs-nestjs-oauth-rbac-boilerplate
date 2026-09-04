import { PipeTransform, Injectable, HttpStatus } from '@nestjs/common';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';

const OBJECT_ID_REGEX = /^[0-9a-fA-F]{24}$/;

/**
 * Validates that a route parameter is a 24-character hexadecimal string.
 * Throws an AppException with code INVALID_INPUT and status 400 when validation fails.
 */
@Injectable()
export class ParseObjectIdPipe implements PipeTransform<string, string> {
  transform(value: string): string {
    if (typeof value !== 'string' || !OBJECT_ID_REGEX.test(value)) {
      throw new AppException(
        ErrorCode.INVALID_INPUT,
        'Invalid identifier format',
        HttpStatus.BAD_REQUEST,
      );
    }
    return value;
  }
}
