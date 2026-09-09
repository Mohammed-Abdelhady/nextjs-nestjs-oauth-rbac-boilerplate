import { ErrorCode } from '../../../common/enums/error-code.enum';
import { PASSKEY_CHALLENGE_COOKIE } from '../constants/passkeys.constants';
import {
  createChallengeService,
  createMockRequest,
  createMockResponse,
  USER_ID,
} from '../passkeys.harness-spec';

describe('PasskeyChallengeService', () => {
  it('should hand out a signed cookie and read it back', async () => {
    const service = createChallengeService();
    const { response, cookies } = createMockResponse();

    await service.issue(
      response,
      'register',
      'challenge-value',
      USER_ID.toString(),
    );

    const raw = cookies[PASSKEY_CHALLENGE_COOKIE];
    expect(raw).toEqual(expect.stringContaining('.'));

    const payload = service.read(
      createMockRequest({ [PASSKEY_CHALLENGE_COOKIE]: raw }),
      'register',
    );

    expect(payload.challenge).toBe('challenge-value');
    expect(payload.sub).toBe(USER_ID.toString());
  });

  it('should leave the sign-in challenge without an account on it', async () => {
    const service = createChallengeService();
    const { response, cookies } = createMockResponse();

    await service.issue(response, 'login', 'challenge-value');
    const payload = service.read(
      createMockRequest({
        [PASSKEY_CHALLENGE_COOKIE]: cookies[PASSKEY_CHALLENGE_COOKIE],
      }),
      'login',
    );

    expect(payload.sub).toBeUndefined();
  });

  it('should refuse a challenge issued for the other ceremony', async () => {
    const service = createChallengeService();
    const { response, cookies } = createMockResponse();

    await service.issue(
      response,
      'register',
      'challenge-value',
      USER_ID.toString(),
    );

    expect(() =>
      service.read(
        createMockRequest({
          [PASSKEY_CHALLENGE_COOKIE]: cookies[PASSKEY_CHALLENGE_COOKIE],
        }),
        'login',
      ),
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.PASSKEY_CHALLENGE_INVALID,
        status: 401,
      }) as Error,
    );
  });

  it('should refuse an edited payload', async () => {
    const service = createChallengeService();
    const { response, cookies } = createMockResponse();
    await service.issue(response, 'login', 'challenge-value');

    const [, signature] = cookies[PASSKEY_CHALLENGE_COOKIE].split('.');
    const forged = Buffer.from(
      JSON.stringify({
        purpose: 'login',
        challenge: 'other-value',
        expiresAt: Date.now() + 60000,
      }),
    ).toString('base64url');

    expect(() =>
      service.read(
        createMockRequest({
          [PASSKEY_CHALLENGE_COOKIE]: `${forged}.${signature}`,
        }),
        'login',
      ),
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.PASSKEY_CHALLENGE_INVALID,
      }) as Error,
    );
  });

  it('should refuse a cookie signed with another secret', async () => {
    const issuer = createChallengeService();
    const { response, cookies } = createMockResponse();
    await issuer.issue(response, 'login', 'challenge-value');

    const other = createChallengeService({
      'oauth.stateSecret': 'a'.repeat(32),
    });

    expect(() =>
      other.read(
        createMockRequest({
          [PASSKEY_CHALLENGE_COOKIE]: cookies[PASSKEY_CHALLENGE_COOKIE],
        }),
        'login',
      ),
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.PASSKEY_CHALLENGE_INVALID,
      }) as Error,
    );
  });

  it('should refuse an expired challenge', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    const service = createChallengeService();
    const { response, cookies } = createMockResponse();
    await service.issue(response, 'login', 'challenge-value');

    jest.setSystemTime(new Date('2026-01-01T00:06:00.000Z'));

    expect(() =>
      service.read(
        createMockRequest({
          [PASSKEY_CHALLENGE_COOKIE]: cookies[PASSKEY_CHALLENGE_COOKIE],
        }),
        'login',
      ),
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.PASSKEY_CHALLENGE_INVALID,
      }) as Error,
    );

    jest.useRealTimers();
  });

  it('should refuse a request with no cookie at all', () => {
    expect(() =>
      createChallengeService().read(createMockRequest({}), 'login'),
    ).toThrow(
      expect.objectContaining({
        code: ErrorCode.PASSKEY_CHALLENGE_INVALID,
      }) as Error,
    );
  });

  it('should report 503 when the signing secret is missing', async () => {
    const service = createChallengeService({ NODE_ENV: 'test' });
    const { response } = createMockResponse();

    await expect(
      service.issue(response, 'login', 'challenge-value'),
    ).rejects.toMatchObject({
      code: ErrorCode.PASSKEY_NOT_CONFIGURED,
      status: 503,
    });
  });

  it('should clear the cookie it set', () => {
    const service = createChallengeService();
    const { response, cleared } = createMockResponse();

    service.clear(response);

    expect(cleared).toEqual([PASSKEY_CHALLENGE_COOKIE]);
  });
});
