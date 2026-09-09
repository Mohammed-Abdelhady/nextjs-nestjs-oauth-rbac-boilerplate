import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ThrottlerException } from '@nestjs/throttler';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';
import { ErrorResponse } from '../dto/api-response.dto';
import { RequestWithId } from '../interfaces/request-with-id.interface';
import {
  isCastError,
  isMongoDuplicateKeyError,
  isDuplicateEmailError,
} from '../utils/mongo-error.util';

/**
 * Global exception filter that transforms exceptions into standardized error responses.
 * Handles AppException, ThrottlerException, HttpException, CastError, MongoServerError 11000, and unknown errors.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const requestId = ctx.getRequest<RequestWithId>().requestId;

    const tag = requestId ? ` [${requestId}]` : '';

    let errorResponse: ErrorResponse;
    let statusCode: number;

    if (exception instanceof AppException) {
      statusCode = exception.getStatus();
      errorResponse = ErrorResponse.error(
        exception.getCode(),
        exception.message,
        exception.getDetails(),
      );
      this.logger.warn(
        `AppException: ${exception.getCode()} - ${exception.message}${tag}`,
      );
    } else if (exception instanceof ThrottlerException) {
      statusCode = HttpStatus.TOO_MANY_REQUESTS;
      const res = exception.getResponse();
      const retryAfter =
        typeof res === 'object' && res !== null && 'retryAfter' in res
          ? (res as { retryAfter: number }).retryAfter
          : 60;
      errorResponse = ErrorResponse.error(
        ErrorCode.RATE_LIMIT_EXCEEDED,
        'Too many requests',
        { retryAfter },
      );
      this.logger.warn(`ThrottlerException: ${exception.message}${tag}`);
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();

      const validationResult = this.extractValidationErrors(exception);
      if (validationResult) {
        errorResponse = ErrorResponse.error(
          ErrorCode.VALIDATION_ERROR,
          'Validation failed',
          validationResult,
        );
        this.logger.warn(
          `ValidationException: ${JSON.stringify(validationResult.fields)}${tag}`,
        );
      } else {
        const code = this.mapHttpStatusToErrorCode(statusCode);
        errorResponse = ErrorResponse.error(code, exception.message);
        this.logger.warn(
          `HttpException (${statusCode}): ${code} - ${exception.message}${tag}`,
        );
      }
    } else if (isCastError(exception)) {
      statusCode = HttpStatus.BAD_REQUEST;
      errorResponse = ErrorResponse.error(
        ErrorCode.INVALID_INPUT,
        exception.message || 'Invalid input',
      );
      this.logger.warn(`CastError: ${exception.message}${tag}`);
    } else if (isMongoDuplicateKeyError(exception)) {
      statusCode = HttpStatus.CONFLICT;
      const isEmail = isDuplicateEmailError(exception);
      const code = isEmail
        ? ErrorCode.EMAIL_ALREADY_EXISTS
        : ErrorCode.CONFLICT;
      const message = isEmail
        ? 'Email already registered'
        : 'Resource conflict occurred';
      errorResponse = ErrorResponse.error(code, message);
      this.logger.warn(
        `MongoDuplicateKeyError (11000): ${code} - ${exception.message}${tag}`,
      );
    } else {
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = ErrorResponse.error(
        ErrorCode.INTERNAL_ERROR,
        'An unexpected error occurred',
      );
      this.logger.error(
        `Unknown exception: ${exception instanceof Error ? exception.message : String(exception)}${tag}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    if (requestId) {
      errorResponse.requestId = requestId;
    }

    response.status(statusCode).json(errorResponse);
  }

  /**
   * Maps HTTP status codes to standardized error codes when not thrown as an AppException.
   */
  private mapHttpStatusToErrorCode(status: number): ErrorCode {
    switch (status as HttpStatus) {
      case HttpStatus.BAD_REQUEST:
        return ErrorCode.INVALID_INPUT;
      case HttpStatus.UNAUTHORIZED:
        return ErrorCode.SESSION_INVALID;
      case HttpStatus.FORBIDDEN:
        return ErrorCode.FORBIDDEN;
      case HttpStatus.NOT_FOUND:
        return ErrorCode.NOT_FOUND;
      case HttpStatus.CONFLICT:
        return ErrorCode.CONFLICT;
      case HttpStatus.TOO_MANY_REQUESTS:
        return ErrorCode.RATE_LIMIT_EXCEEDED;
      default:
        return ErrorCode.INTERNAL_ERROR;
    }
  }

  /**
   * Extracts validation errors from BadRequestException thrown by ValidationPipe.
   */
  private extractValidationErrors(
    exception: HttpException,
  ): { fields: Record<string, string[]> } | null {
    const status = exception.getStatus() as HttpStatus;
    if (status !== HttpStatus.BAD_REQUEST) {
      return null;
    }

    const response = exception.getResponse();
    if (typeof response !== 'object' || response === null) {
      return null;
    }

    const responseObj = response as Record<string, unknown>;
    const messages = responseObj.message;

    if (!Array.isArray(messages) || messages.length === 0) {
      return null;
    }

    const fields: Record<string, string[]> = {};
    for (const msg of messages) {
      if (typeof msg === 'string') {
        const fieldMatch = msg.match(/^(\w+)\s/);
        const fieldName = fieldMatch ? fieldMatch[1] : 'general';
        if (!fields[fieldName]) {
          fields[fieldName] = [];
        }
        fields[fieldName].push(msg);
      }
    }

    return { fields };
  }
}
