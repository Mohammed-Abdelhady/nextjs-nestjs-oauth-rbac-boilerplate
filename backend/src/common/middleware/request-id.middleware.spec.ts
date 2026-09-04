import { Response } from 'express';
import { RequestIdMiddleware } from './request-id.middleware';
import { RequestWithId } from '../interfaces/request-with-id.interface';
import {
  REQUEST_ID_HEADER,
  REQUEST_ID_MAX_LENGTH,
} from '../constants/request-id';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('RequestIdMiddleware (X-19)', () => {
  const middleware = new RequestIdMiddleware();

  const run = (
    incoming?: string,
  ): { request: RequestWithId; setHeader: jest.Mock; next: jest.Mock } => {
    const request = {
      header: jest.fn().mockReturnValue(incoming),
    } as unknown as RequestWithId;
    const setHeader = jest.fn();
    const next = jest.fn();

    middleware.use(request, { setHeader } as unknown as Response, next);

    return { request, setHeader, next };
  };

  it('should generate a UUID when the client sends no id', () => {
    const { request, setHeader, next } = run();

    expect(request.requestId).toMatch(UUID_PATTERN);
    expect(setHeader).toHaveBeenCalledWith(
      REQUEST_ID_HEADER,
      request.requestId,
    );
    expect(next).toHaveBeenCalled();
  });

  it('should reuse an id that the client sent', () => {
    const { request } = run('trace-abc.123:456');

    expect(request.requestId).toBe('trace-abc.123:456');
  });

  it('should replace an id holding unexpected characters', () => {
    const { request } = run('<script>alert(1)</script>');

    expect(request.requestId).toMatch(UUID_PATTERN);
  });

  it('should replace an id that is too long', () => {
    const { request } = run('a'.repeat(REQUEST_ID_MAX_LENGTH + 1));

    expect(request.requestId).toMatch(UUID_PATTERN);
  });

  it('should keep an id of the maximum length', () => {
    const atLimit = 'a'.repeat(REQUEST_ID_MAX_LENGTH);
    const { request } = run(atLimit);

    expect(request.requestId).toBe(atLimit);
  });
});
