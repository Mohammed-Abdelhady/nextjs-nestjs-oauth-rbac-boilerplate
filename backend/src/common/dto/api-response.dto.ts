import { ErrorCode } from '../enums/error-code.enum';
import { ApiProperty, ApiExtraModels } from '@nestjs/swagger';

/**
 * Standard success response wrapper.
 * All successful API responses should use this format.
 */
export class ApiResponse<T> {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: true,
  })
  success = true as const;

  @ApiProperty({
    description: 'Response data payload',
  })
  data: T;

  @ApiProperty({
    description: 'Optional human-readable message',
    example: 'Operation completed successfully',
    required: false,
  })
  message?: string;

  constructor(data: T, message?: string) {
    this.data = data;
    this.message = message;
  }

  /**
   * Factory method to create a success response.
   * @param data The response data
   * @param message Optional human-readable message
   * @returns ApiResponse instance
   */
  static success<T>(data: T, message?: string): ApiResponse<T> {
    return new ApiResponse(data, message);
  }
}

/**
 * Error details structure for Swagger documentation.
 */
export class ErrorDetails {
  @ApiProperty({
    description: 'Machine-readable error code for frontend i18n',
    example: 'INVALID_CREDENTIALS',
    enum: Object.values(ErrorCode),
  })
  code!: ErrorCode;

  @ApiProperty({
    description: 'Human-readable error message',
    example: 'Invalid email or password',
  })
  message!: string;

  @ApiProperty({
    description: 'Optional additional context (e.g., field errors, retry info)',
    example: { remainingAttempts: 3 },
    required: false,
    type: Object,
    additionalProperties: true,
  })
  details?: Record<string, unknown>;
}

/**
 * Standard error response structure.
 * All error API responses should use this format.
 *
 * Frontend can use the error.code for i18n translation lookup.
 */
@ApiExtraModels(ErrorDetails)
export class ErrorResponse {
  @ApiProperty({
    description: 'Indicates if the request was successful',
    example: false,
  })
  success = false as const;

  @ApiProperty({
    description: 'Error details including code and message',
    type: ErrorDetails,
  })
  error: ErrorDetails;

  constructor(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    this.error = {
      code,
      message,
      details,
    };
  }

  /**
   * Factory method to create an error response.
   * @param code The error code
   * @param message Human-readable error message
   * @param details Optional additional context
   * @returns ErrorResponse instance
   */
  static error(
    code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ): ErrorResponse {
    return new ErrorResponse(code, message, details);
  }
}

/**
 * Common error responses for Swagger documentation.
 * Use these with @ApiResponse decorator for consistent documentation.
 */
export const CommonErrorResponses = {
  /** 400 Bad Request - Validation errors */
  VALIDATION_ERROR: {
    status: 400,
    description: 'Validation failed',
    schema: {
      example: {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          details: {
            errors: [
              { field: 'email', messages: ['email must be a valid email'] },
            ],
          },
        },
      },
    },
  },
  /** 401 Unauthorized - Authentication required */
  UNAUTHORIZED: {
    status: 401,
    description: 'Authentication required',
    schema: {
      example: {
        success: false,
        error: {
          code: 'SESSION_REQUIRED',
          message: 'Please log in to continue',
        },
      },
    },
  },
  /** 403 Forbidden - Insufficient permissions */
  FORBIDDEN: {
    status: 403,
    description: 'Insufficient permissions',
    schema: {
      example: {
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: "You don't have permission to perform this action",
        },
      },
    },
  },
  /** 404 Not Found - Resource not found */
  NOT_FOUND: {
    status: 404,
    description: 'Resource not found',
    schema: {
      example: {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'The requested resource was not found',
        },
      },
    },
  },
  /** 429 Too Many Requests - Rate limit exceeded */
  RATE_LIMIT: {
    status: 429,
    description: 'Rate limit exceeded',
    schema: {
      example: {
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please wait before trying again',
          details: { retryAfter: 60 },
        },
      },
    },
  },
  /** 500 Internal Server Error */
  INTERNAL_ERROR: {
    status: 500,
    description: 'Internal server error',
    schema: {
      example: {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Something went wrong. Please try again later',
        },
      },
    },
  },
};
