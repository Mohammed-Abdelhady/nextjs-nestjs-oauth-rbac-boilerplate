import { HttpStatus, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { partialMock } from '../../common/testing/test-doubles.harness-spec';
import { OAuthRedirectService } from './oauth-redirect.service';

const CLIENT_URL = 'http://localhost:3000';

describe('OAuthRedirectService toClientError logging', () => {
  it('logs the provider and the error code, never the provider text', () => {
    const service = new OAuthRedirectService(
      partialMock<ConfigService>({
        get: jest.fn().mockReturnValue(CLIENT_URL),
      }),
    );
    const redirect = jest.fn();
    const response = partialMock<Response>({ redirect });

    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    service.toClientError(
      response,
      new AppException(
        ErrorCode.OAUTH_CODE_INVALID,
        'provider said: this one-time code was already spent',
        HttpStatus.BAD_REQUEST,
        { provider: 'google' },
      ),
      'google',
    );

    const logged = warnSpy.mock.calls
      .map((call: unknown[]) => call.map((v) => String(v)).join(' '))
      .join('\n');
    expect(logged).toContain('google');
    expect(logged).toContain(ErrorCode.OAUTH_CODE_INVALID);
    expect(logged).not.toContain('one-time code was already spent');
    expect(redirect).toHaveBeenCalledWith(
      HttpStatus.FOUND,
      expect.stringContaining(`code=${ErrorCode.OAUTH_CODE_INVALID}`),
    );
    warnSpy.mockRestore();
  });

  it('names a non-code failure instead of quoting its text', () => {
    const service = new OAuthRedirectService(
      partialMock<ConfigService>({
        get: jest.fn().mockReturnValue(CLIENT_URL),
      }),
    );
    const redirect = jest.fn();
    const response = partialMock<Response>({ redirect });

    const warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});

    service.toClientError(
      response,
      new TypeError('fetch failed for a@b.c with secret-value'),
      'google',
    );

    const logged = warnSpy.mock.calls
      .map((call: unknown[]) => call.map((v) => String(v)).join(' '))
      .join('\n');
    expect(logged).toContain('google');
    expect(logged).toContain('name=TypeError');
    expect(logged).not.toContain('a@b.c');
    expect(logged).not.toContain('secret-value');
    warnSpy.mockRestore();
  });
});
