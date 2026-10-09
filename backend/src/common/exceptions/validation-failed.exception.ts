import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../enums/error-code.enum';
import { AppException } from './app.exception';

export const VALIDATION_FAILED_MESSAGE = 'Validation failed';

/** What a log line may say about a failed validation: names from the DTO, never input. */
export interface ValidationLogSummary {
  fieldNames: string[];
  /** Failures left out: unknown properties, unsafe names, and anything past the cap. */
  omittedCount: number;
}

/**
 * A request the validation pipe refused. The response body is the one every
 * `VALIDATION_ERROR` has; the summary is for the log only.
 */
export class ValidationFailedException extends AppException {
  constructor(
    fields: Record<string, string[]>,
    readonly logSummary: ValidationLogSummary,
  ) {
    super(
      ErrorCode.VALIDATION_ERROR,
      VALIDATION_FAILED_MESSAGE,
      HttpStatus.BAD_REQUEST,
      { fields },
    );
  }
}
