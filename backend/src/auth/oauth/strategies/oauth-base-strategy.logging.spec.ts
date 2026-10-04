import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuthFailureReason } from '../oauth.constants';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { partialMock } from '../../../common/testing/test-doubles.harness-spec';
import { joseCodeOf } from '../base-oauth.strategy';
import { ProbeStrategy } from './oauth-base-strategy.harness-spec';

describe('OAuth failure logging in the base strategy', () => {
  let warnSpy: jest.SpyInstance;
  let probe: ProbeStrategy;

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    probe = new ProbeStrategy(
      partialMock<ConfigService>({ get: jest.fn().mockReturnValue({}) }),
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function logged(): string {
    return warnSpy.mock.calls
      .map((call: unknown[]) => call.map((v) => String(v)).join(' '))
      .join('\n');
  }

  it('names the provider, the reason and the error code when a code exchange fails', () => {
    const failure = probe.exchangeFailure(OAuthFailureReason.NO_ACCESS_TOKEN);

    expect(failure.getCode()).toBe(ErrorCode.OAUTH_CODE_INVALID);
    expect(logged()).toContain('probe');
    expect(logged()).toContain(ErrorCode.OAUTH_CODE_INVALID);
    expect(logged()).toContain('reason=no_access_token');
  });

  it('names the provider, the reason and the error code when a profile fetch fails', () => {
    const failure = probe.profileFailure(OAuthFailureReason.NO_EMAIL);

    expect(failure.getCode()).toBe(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
    expect(logged()).toContain('probe');
    expect(logged()).toContain(ErrorCode.OAUTH_AUTHENTICATION_FAILED);
    expect(logged()).toContain('reason=no_email');
  });

  it('quotes an RFC 6749 provider code and never a free-text one', () => {
    probe.exchangeFailure(OAuthFailureReason.INVALID_TOKEN, {
      providerCode: 'invalid_grant',
    });
    expect(logged()).toContain('providerCode=invalid_grant');

    warnSpy.mockClear();
    probe.exchangeFailure(OAuthFailureReason.PROVIDER_ERROR, {
      providerCode: 'your client secret is wrong, rotate it',
    });
    expect(logged()).toContain('reason=provider_error');
    expect(logged()).toContain('providerCode=unlisted');
    expect(logged()).not.toContain('your client secret');
  });

  it('omits the provider code when none was supplied', () => {
    probe.exchangeFailure(OAuthFailureReason.PROVIDER_ERROR);
    expect(logged()).not.toContain('providerCode=');
  });

  it('quotes a jose machine code and never its message', () => {
    const joseFailure = {
      name: 'JWTExpired',
      code: 'ERR_JWT_EXPIRED',
      message: '"exp" claim timestamp check failed',
    };
    probe.profileFailure(OAuthFailureReason.INVALID_TOKEN, {
      joseCode: joseCodeOf(joseFailure),
    });
    expect(logged()).toContain('joseCode=ERR_JWT_EXPIRED');
    expect(logged()).not.toContain('timestamp check');
  });

  it('carries the numeric HTTP status on a transport failure', () => {
    probe.profileFailure(OAuthFailureReason.HTTP_STATUS, { httpStatus: 503 });
    expect(logged()).toContain('status=503');
  });

  it.each([
    { error: 'invalid_client', code: 'providerCode=invalid_client' },
    { error: 'invalid_grant', code: 'providerCode=invalid_grant' },
    { error: 'secret@example.com hunter2', code: 'providerCode=unlisted' },
  ])(
    'logs failed HTTP responses with only a standard provider code $error',
    async ({ error, code }) => {
      jest.spyOn(global, 'fetch').mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              error,
              error_description: 'secret@example.com hunter2',
            }),
            { status: 401, statusText: 'secret@example.com' },
          ),
        ),
      );
      await expect(
        probe.exchangeCode({
          code: 'spent',
          redirectUri: 'https://probe.example/callback',
        }),
      ).rejects.toMatchObject({ code: ErrorCode.OAUTH_CODE_INVALID });
      expect(logged()).toContain('reason=http_status status=401');
      expect(logged()).toContain(code);
      expect(logged()).not.toContain('secret@example.com');
      expect(logged()).not.toContain('hunter2');
    },
  );

  it.each([
    { name: 'TypeError', reason: 'network' },
    { name: 'TimeoutError', reason: 'timeout' },
    { name: 'AbortError', reason: 'timeout' },
  ])(
    'logs a closed transport reason for $name on both HTTP helpers',
    async ({ name, reason }) => {
      jest
        .spyOn(global, 'fetch')
        .mockRejectedValue(
          Object.assign(new Error('secret@example.com hunter2'), { name }),
        );
      await expect(
        probe.exchangeCode({
          code: 'spent',
          redirectUri: 'https://probe.example/callback',
        }),
      ).rejects.toBeInstanceOf(AppException);
      await expect(
        probe.fetchProfile({ accessToken: 'token' }),
      ).rejects.toBeInstanceOf(AppException);
      expect(warnSpy).toHaveBeenCalledTimes(2);
      expect(logged()).toContain(`reason=${reason}`);
      expect(logged()).not.toContain('secret@example.com');
      expect(logged()).not.toContain('hunter2');
    },
  );

  it('logs a malformed provider JSON response without its contents', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockImplementation(() =>
        Promise.resolve(new Response('secret@example.com hunter2')),
      );
    await expect(
      probe.fetchProfile({ accessToken: 'token' }),
    ).rejects.toBeInstanceOf(AppException);
    expect(logged()).toContain('reason=malformed_response');
    expect(logged()).not.toContain('secret@example.com');
  });

  it.each([
    'invalid_request',
    'invalid_client',
    'invalid_grant',
    'unauthorized_client',
    'unsupported_grant_type',
    'unsupported_response_type',
    'invalid_scope',
    'access_denied',
    'server_error',
    'temporarily_unavailable',
  ])('retains the standard machine code %s', (providerCode) => {
    probe.exchangeFailure(OAuthFailureReason.PROVIDER_ERROR, { providerCode });
    expect(logged()).toContain(`providerCode=${providerCode}`);
  });

  it('refuses arbitrary jose code fields', () => {
    probe.profileFailure(OAuthFailureReason.INVALID_TOKEN, {
      joseCode: 'secret@example.com',
    });
    expect(logged()).not.toContain('joseCode=');
    expect(
      joseCodeOf({ code: { email: 'secret@example.com' } }),
    ).toBeUndefined();
  });
});
