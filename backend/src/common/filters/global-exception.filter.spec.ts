import { Test, TestingModule } from '@nestjs/testing';
import { GlobalExceptionFilter } from './global-exception.filter';
import { AppException } from '../exceptions/app.exception';
import { ErrorCode } from '../enums/error-code.enum';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { Response } from 'express';
import { ArgumentsHost } from '@nestjs/common';
import { RequestWithId } from '../interfaces/request-with-id.interface';

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let mockResponse: Partial<Response>;
  let mockRequest: RequestWithId;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [GlobalExceptionFilter],
    }).compile();

    filter = module.get<GlobalExceptionFilter>(GlobalExceptionFilter);

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };

    mockRequest = {} as RequestWithId;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  function createMockHost(): ArgumentsHost {
    return {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse,
        getRequest: () => mockRequest,
      }),
    } as unknown as ArgumentsHost;
  }

  describe('AppException handling', () => {
    it('passes through AppException with code, message and status', () => {
      const exception = new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already registered',
        HttpStatus.CONFLICT,
      );

      filter.catch(exception, createMockHost());

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.EMAIL_ALREADY_EXISTS,
            message: 'Email already registered',
          }),
        }),
      );
    });

    it('passes through details when provided', () => {
      const exception = new AppException(
        ErrorCode.ACTIVATION_CODE_INVALID,
        'Invalid code',
        HttpStatus.BAD_REQUEST,
        { remainingAttempts: 3 },
      );

      filter.catch(exception, createMockHost());

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            details: { remainingAttempts: 3 },
          }),
        }),
      );
    });
  });

  describe('Validation exception handling', () => {
    it('extracts field-level validation errors from ValidationPipe', () => {
      const exception = new HttpException(
        {
          message: [
            'email must be an email',
            'password must be at least 8 characters',
          ],
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, createMockHost());

      expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            message: 'Validation failed',
            details: expect.objectContaining({
              fields: expect.objectContaining({
                email: ['email must be an email'],
                password: ['password must be at least 8 characters'],
              }),
            }),
          }),
        }),
      );
    });

    it('handles single field validation error', () => {
      const exception = new HttpException(
        {
          message: ['name should not be empty'],
          error: 'Bad Request',
          statusCode: 400,
        },
        HttpStatus.BAD_REQUEST,
      );

      filter.catch(exception, createMockHost());

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.VALIDATION_ERROR,
            details: expect.objectContaining({
              fields: expect.objectContaining({
                name: ['name should not be empty'],
              }),
            }),
          }),
        }),
      );
    });
  });

  describe('ThrottlerException handling', () => {
    it('handles ThrottlerException with RATE_LIMIT_EXCEEDED and retryAfter', () => {
      const exception = new ThrottlerException('60');

      filter.catch(exception, createMockHost());

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.TOO_MANY_REQUESTS,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            details: expect.objectContaining({
              retryAfter: 60,
            }),
          }),
        }),
      );
    });
  });

  describe('Unknown exception handling', () => {
    it('maps unhandled Error instances to 500 INTERNAL_ERROR', () => {
      const exception = new Error('Database connection lost');

      filter.catch(exception, createMockHost());

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'An unexpected error occurred',
          }),
        }),
      );
    });

    it('maps non-Error exceptions to 500 INTERNAL_ERROR', () => {
      filter.catch('String exception', createMockHost());

      expect(mockResponse.status).toHaveBeenCalledWith(
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'An unexpected error occurred',
          }),
        }),
      );
    });
  });
});
