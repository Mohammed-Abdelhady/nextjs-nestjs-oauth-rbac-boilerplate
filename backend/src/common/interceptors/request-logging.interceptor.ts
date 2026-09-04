import {
  CallHandler,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Response } from 'express';
import { Observable, tap } from 'rxjs';
import { RequestWithId } from '../interfaces/request-with-id.interface';
import {
  SUCCESS_STATUS_MIN,
  SUCCESS_STATUS_MAX_EXCLUSIVE,
} from '../constants/http-status';

/**
 * Logs one line per handled request: method, path, status, duration and the
 * correlation id. Successful responses log at debug so normal traffic stays out
 * of production logs; anything else logs at log level.
 *
 * Requests rejected by a guard (401, 403, 429) never reach an interceptor, so
 * they are not logged here. The exception filter reports those.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithId>();
    const response = http.getResponse<Response>();
    const startedAt = Date.now();

    return next.handle().pipe(
      tap({
        next: () => this.write(request, response.statusCode, startedAt),
        error: (error: unknown) =>
          this.write(request, this.statusOf(error), startedAt),
      }),
    );
  }

  private write(
    request: RequestWithId,
    status: number,
    startedAt: number,
  ): void {
    const duration = Date.now() - startedAt;
    const requestId = request.requestId ?? '-';
    // Path only: the OAuth callback carries the authorization code in the query
    const path = request.originalUrl.split('?')[0];
    const message = `${request.method} ${path} ${status} ${duration}ms requestId=${requestId}`;

    if (status >= SUCCESS_STATUS_MIN && status < SUCCESS_STATUS_MAX_EXCLUSIVE) {
      this.logger.debug(message);
      return;
    }

    this.logger.log(message);
  }

  private statusOf(error: unknown): number {
    return error instanceof HttpException
      ? error.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
