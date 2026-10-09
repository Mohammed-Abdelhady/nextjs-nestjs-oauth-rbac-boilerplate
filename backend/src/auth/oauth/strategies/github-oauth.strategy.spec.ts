import { Logger } from '@nestjs/common';
import { GitHubOAuthStrategy } from './github-oauth.strategy';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  configFor,
  expectAppException,
  mockFetch,
} from './oauth-strategy.harness-spec';

describe('GitHub OAuth machine-code logging', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function exchangeError(error: string): Promise<string> {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const provider = new GitHubOAuthStrategy(
      configFor('github', { clientId: 'client', clientSecret: 'secret' }),
    );
    mockFetch([
      {
        url: 'https://github.com/login/oauth/access_token',
        body: { error, error_description: 'secret@example.com hunter2' },
      },
    ]);
    const failure = await expectAppException(
      provider.exchangeCode({
        code: 'spent',
        redirectUri: 'https://probe.example/callback',
      }),
      ErrorCode.OAUTH_CODE_INVALID,
    );
    expect(failure.getStatus()).toBe(400);
    const line = warn.mock.calls.flat().join(' ');
    expect(line).toContain('reason=provider_error');
    expect(line).not.toContain('secret@example.com');
    expect(line).not.toContain('hunter2');
    return line;
  }

  it.each([
    {
      error: 'bad_verification_code',
      expected: 'providerCode=bad_verification_code',
    },
    {
      error: 'incorrect_client_credentials',
      expected: 'providerCode=incorrect_client_credentials',
    },
    {
      error: 'redirect_uri_mismatch',
      expected: 'providerCode=redirect_uri_mismatch',
    },
    {
      error: 'unverified_user_email',
      expected: 'providerCode=unverified_user_email',
    },
    { error: 'invalid_grant', expected: 'providerCode=invalid_grant' },
  ])('logs the listed machine code $error', async ({ error, expected }) => {
    expect(await exchangeError(error)).toContain(expected);
  });

  it.each(['secret@example.com hunter2', 'invalid_code'])(
    'marks the unlisted machine code without quoting it: %s',
    async (error) => {
      const line = await exchangeError(error);
      expect(line).toContain('providerCode=unlisted');
      expect(line).not.toContain(error);
    },
  );
});
