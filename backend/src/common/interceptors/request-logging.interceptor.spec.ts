import {
  CallHandler,
  ExecutionContext,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { lastValueFrom, of, throwError } from 'rxjs';
import { RequestLoggingInterceptor } from './request-logging.interceptor';

describe('RequestLoggingInterceptor (X-19)', () => {
  let interceptor: RequestLoggingInterceptor;
  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  const createContext = (
    statusCode: number,
    originalUrl = '/api/user/profile',
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl,
          requestId: 'req-1',
        }),
        getResponse: () => ({ statusCode }),
      }),
    }) as unknown as ExecutionContext;

  const handlerOf = (result: unknown): CallHandler => ({
    handle: () => of(result),
  });

  beforeEach(() => {
    interceptor = new RequestLoggingInterceptor();
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should log a 2xx response at debug with method, path and request id', async () => {
    await lastValueFrom(
      interceptor.intercept(createContext(200), handlerOf({ ok: true })),
    );

    expect(logSpy).not.toHaveBeenCalled();
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/user/profile 200') as string,
    );
    expect(debugSpy).toHaveBeenCalledWith(
      expect.stringContaining('requestId=req-1') as string,
    );
  });

  it('should drop the query string, which carries the OAuth code', async () => {
    await lastValueFrom(
      interceptor.intercept(
        createContext(302, '/api/auth/oauth/google/callback?code=secret'),
        handlerOf(undefined),
      ),
    );

    const [message] = logSpy.mock.calls[0] as [string];
    expect(message).toContain('/api/auth/oauth/google/callback');
    expect(message).not.toContain('code=');
  });

  it('should log a redirect at log level', async () => {
    await lastValueFrom(
      interceptor.intercept(createContext(302), handlerOf(undefined)),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('302') as string,
    );
  });

  it('should log the status of a failing handler', async () => {
    const failing: CallHandler = {
      handle: () => throwError(() => new NotFoundException()),
    };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(200), failing)),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('404') as string,
    );
  });

  it('should report a non-HTTP error as 500', async () => {
    const failing: CallHandler = {
      handle: () => throwError(() => new Error('boom')),
    };

    await expect(
      lastValueFrom(interceptor.intercept(createContext(200), failing)),
    ).rejects.toThrow('boom');

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('500') as string,
    );
  });
});
