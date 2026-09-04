// The verification service reaches the otplib adapter; the delta is driven
// from here instead.
jest.mock('./utils/totp.util', () => ({
  generateTotpSecret: jest.fn(),
  buildOtpauthUrl: jest.fn(),
  checkTotpDelta: jest.fn(),
}));

import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { TwoFactorLoginService } from './two-factor-login.service';
import { TwoFactorChallengeService } from './services/two-factor-challenge.service';
import { TwoFactorVerificationService } from './services/two-factor-verification.service';
import { SignInService } from '../services/sign-in.service';
import { checkTotpDelta } from './utils/totp.util';
import {
  createCrypto,
  createEnabledUser,
  MockUser,
  RECOVERY_CODE,
  USER_ID,
} from './two-factor.harness-spec';
import { ErrorCode } from '../../common/enums/error-code.enum';

const delta = checkTotpDelta as jest.Mock;

const CHALLENGE_ID = new Types.ObjectId('507f1f77bcf86cd799439012');
const MOCK_REQUEST = { cookies: {} } as unknown as Request;
const MOCK_RESPONSE = {
  req: { headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' },
} as unknown as Response;

const USER_SUMMARY = {
  id: USER_ID.toString(),
  email: 'user@example.com',
  name: 'Test User',
  role: 'user',
  authProvider: 'email',
  isVerified: true,
  permissions: ['read'],
};

interface Harness {
  service: TwoFactorLoginService;
  challengeService: {
    read: jest.Mock;
    registerFailure: jest.Mock;
    consume: jest.Mock;
    clear: jest.Mock;
  };
  signInService: { issueSession: jest.Mock };
}

function createHarness(user: MockUser | null): Harness {
  const userModel = { findById: jest.fn().mockResolvedValue(user) };

  const challengeService = {
    read: jest
      .fn()
      .mockResolvedValue({ challengeId: CHALLENGE_ID, userId: USER_ID }),
    registerFailure: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
    clear: jest.fn(),
  };

  const signInService = {
    issueSession: jest.fn().mockResolvedValue(USER_SUMMARY),
  };

  return {
    service: new TwoFactorLoginService(
      userModel as unknown as ConstructorParameters<
        typeof TwoFactorLoginService
      >[0],
      challengeService as unknown as TwoFactorChallengeService,
      new TwoFactorVerificationService(createCrypto()),
      signInService as unknown as SignInService,
    ),
    challengeService,
    signInService,
  };
}

describe('TwoFactorLoginService', () => {
  beforeEach(() => {
    delta.mockReset();
  });

  it('should finish the sign-in and clear the challenge on a valid code', async () => {
    const user = createEnabledUser(createCrypto());
    const harness = createHarness(user);
    delta.mockReturnValue(0);

    const result = await harness.service.verify(
      { code: '123456' },
      MOCK_REQUEST,
      MOCK_RESPONSE,
    );

    expect(result.data).toEqual({
      requiresTwoFactor: false,
      user: USER_SUMMARY,
    });
    expect(harness.challengeService.consume).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(harness.challengeService.clear).toHaveBeenCalledWith(MOCK_RESPONSE);
    expect(harness.signInService.issueSession).toHaveBeenCalledWith(
      user,
      MOCK_RESPONSE,
    );
  });

  it('should finish the sign-in on a recovery code and spend it', async () => {
    const user = createEnabledUser(createCrypto());
    const harness = createHarness(user);

    await harness.service.verify(
      { recoveryCode: RECOVERY_CODE },
      MOCK_REQUEST,
      MOCK_RESPONSE,
    );

    expect(user.twoFactor.recoveryCodes[0].usedAt).toEqual(expect.any(Date));
    expect(harness.signInService.issueSession).toHaveBeenCalled();
  });

  it('should count a wrong code against the challenge and keep it open', async () => {
    const harness = createHarness(createEnabledUser(createCrypto()));
    delta.mockReturnValue(null);

    await expect(
      harness.service.verify({ code: '000000' }, MOCK_REQUEST, MOCK_RESPONSE),
    ).rejects.toMatchObject({ code: ErrorCode.TWO_FACTOR_CODE_INVALID });

    expect(harness.challengeService.registerFailure).toHaveBeenCalledWith(
      CHALLENGE_ID,
    );
    expect(harness.challengeService.consume).not.toHaveBeenCalled();
    expect(harness.signInService.issueSession).not.toHaveBeenCalled();
  });

  it('should refuse a challenge whose account is gone', async () => {
    const harness = createHarness(null);

    await expect(
      harness.service.verify({ code: '123456' }, MOCK_REQUEST, MOCK_RESPONSE),
    ).rejects.toMatchObject({
      code: ErrorCode.TWO_FACTOR_CHALLENGE_INVALID,
      status: 401,
    });
    expect(harness.challengeService.consume).toHaveBeenCalledWith(CHALLENGE_ID);
    expect(harness.challengeService.clear).toHaveBeenCalledWith(MOCK_RESPONSE);
  });

  it('should refuse a challenge for an account that turned the factor off', async () => {
    const user = createEnabledUser(createCrypto());
    user.twoFactor.enabled = false;

    await expect(
      createHarness(user).service.verify(
        { code: '123456' },
        MOCK_REQUEST,
        MOCK_RESPONSE,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.TWO_FACTOR_CHALLENGE_INVALID });
  });

  it('should pass on the rejection when there is no usable challenge', async () => {
    const harness = createHarness(createEnabledUser(createCrypto()));
    harness.challengeService.read.mockRejectedValue(
      new Error('challenge is unknown'),
    );

    await expect(
      harness.service.verify({ code: '123456' }, MOCK_REQUEST, MOCK_RESPONSE),
    ).rejects.toThrow('challenge is unknown');
    expect(harness.signInService.issueSession).not.toHaveBeenCalled();
  });
});
