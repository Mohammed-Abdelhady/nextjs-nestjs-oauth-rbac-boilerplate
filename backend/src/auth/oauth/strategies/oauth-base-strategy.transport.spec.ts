import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppException } from '../../../common/exceptions/app.exception';
import { OAuthFailureReason } from '../oauth.constants';
import { ProbeStrategy } from './oauth-base-strategy.harness-spec';

describe('OAuth transport failures distinguish outages from rejected credentials', () => {
  const probe = new ProbeStrategy(new ConfigService());
  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  function logged(): string {
    return warnSpy.mock.calls.flat().join(' ');
  }
  it.each([
    {
      reason: 'network',
      exchangeCode: 'OAUTH_AUTHENTICATION_FAILED',
      exchangeStatus: 502,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: 'timeout',
      exchangeCode: 'OAUTH_AUTHENTICATION_FAILED',
      exchangeStatus: 502,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: 'malformed_response',
      exchangeCode: 'OAUTH_AUTHENTICATION_FAILED',
      exchangeStatus: 502,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: 'http_status',
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
  ])(
    'returns the failure code and status for $reason on both HTTP helpers',
    async (row) => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      if (row.reason === 'network')
        fetchSpy.mockRejectedValue(new TypeError('offline'));
      else if (row.reason === 'timeout')
        fetchSpy.mockRejectedValue(
          Object.assign(new Error('offline'), { name: 'TimeoutError' }),
        );
      else
        fetchSpy.mockImplementation(() =>
          Promise.resolve(
            row.reason === 'malformed_response'
              ? new Response('not JSON')
              : new Response('{"error":"invalid_grant"}', { status: 401 }),
          ),
        );
      const calls = [
        {
          run: () =>
            probe.exchangeCode({
              code: 'spent',
              redirectUri: 'https://probe.example/callback',
            }),
          code: row.exchangeCode,
          status: row.exchangeStatus,
        },
        {
          run: () => probe.fetchProfile({ accessToken: 'token' }),
          code: row.profileCode,
          status: row.profileStatus,
        },
      ];
      for (const call of calls) {
        warnSpy.mockClear();
        let failure: unknown;
        try {
          await call.run();
        } catch (error) {
          failure = error;
        }
        expect(failure).toBeInstanceOf(AppException);
        if (!(failure instanceof AppException))
          throw new Error('Expected OAuth failure');
        expect(failure.getCode()).toBe(call.code);
        expect(failure.getStatus()).toBe(call.status);
        expect(logged()).toMatch(new RegExp(`reason=${row.reason}(?:\\s|$)`));
      }
    },
  );

  it.each([
    {
      reason: OAuthFailureReason.NO_ACCESS_TOKEN,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.NO_ID_TOKEN,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.NO_EMAIL,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.MISSING_NONCE,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.SUBJECT_MISMATCH,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.CLIENT_SECRET_SIGNING,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.INVALID_TOKEN,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
    {
      reason: OAuthFailureReason.PROVIDER_ERROR,
      exchangeCode: 'OAUTH_CODE_INVALID',
      exchangeStatus: 400,
      profileCode: 'OAUTH_AUTHENTICATION_FAILED',
      profileStatus: 502,
    },
  ])('preserves semantic failure code and status for $reason', (row) => {
    const exchange = probe.exchangeFailure(row.reason);
    expect(exchange.getCode()).toBe(row.exchangeCode);
    expect(exchange.getStatus()).toBe(row.exchangeStatus);
    const profile = probe.profileFailure(row.reason);
    expect(profile.getCode()).toBe(row.profileCode);
    expect(profile.getStatus()).toBe(row.profileStatus);
  });
});
