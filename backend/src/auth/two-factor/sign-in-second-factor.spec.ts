import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { Types } from 'mongoose';
import { SignInService } from '../services/sign-in.service';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import { AuthFeaturesService } from '../services/auth-features.service';
import { TwoFactorChallengeService } from './services/two-factor-challenge.service';
import { UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';

/**
 * What the shared sign-in path does for an account that owes a code. The rest
 * of SignInService is covered next to the service itself.
 */

const USER_ID = new Types.ObjectId('507f1f77bcf86cd799439011');

const MOCK_RESPONSE = {
  req: { headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' },
} as unknown as Response;

interface Harness {
  service: SignInService;
  sessionService: { createSession: jest.Mock };
  sessionCookieService: { set: jest.Mock };
  challengeService: { issue: jest.Mock };
}

function createHarness(twoFactorFeatureOn = true): Harness {
  const roleModel = {
    findOne: jest.fn().mockReturnValue({
      exec: jest
        .fn()
        .mockResolvedValue({ slug: 'user', permissions: ['read'] }),
    }),
  };

  const sessionService = {
    createSession: jest.fn().mockResolvedValue('session-token-123'),
  };
  const sessionCookieService = { set: jest.fn() };
  const challengeService = { issue: jest.fn().mockResolvedValue(undefined) };

  const configService = {
    get: <T>(key: string, fallback?: T): T | undefined =>
      key === 'twoFactor.enabled' ? (twoFactorFeatureOn as T) : fallback,
  } as unknown as ConfigService;

  return {
    service: new SignInService(
      roleModel as unknown as ConstructorParameters<typeof SignInService>[0],
      sessionService as unknown as SessionService,
      sessionCookieService as unknown as SessionCookieService,
      new AuthFeaturesService(configService),
      challengeService as unknown as TwoFactorChallengeService,
    ),
    sessionService,
    sessionCookieService,
    challengeService,
  };
}

function userWith(twoFactorEnabled: boolean): UserDocument {
  return {
    _id: USER_ID,
    email: 'user@example.com',
    name: 'Test User',
    role: 'user',
    permissions: [],
    authProvider: AuthProvider.EMAIL,
    isVerified: true,
    isDeleted: false,
    twoFactor: { enabled: twoFactorEnabled },
  } as unknown as UserDocument;
}

describe('SignInService with a second factor', () => {
  it('should hold the session and open a challenge when a code is owed', async () => {
    const harness = createHarness();

    const outcome = await harness.service.completeSignIn(
      userWith(true),
      MOCK_RESPONSE,
    );

    expect(outcome).toEqual({ requiresTwoFactor: true });
    expect(harness.challengeService.issue).toHaveBeenCalledWith(
      USER_ID,
      MOCK_RESPONSE,
    );
    expect(harness.sessionService.createSession).not.toHaveBeenCalled();
    expect(harness.sessionCookieService.set).not.toHaveBeenCalled();
  });

  it('should sign in directly when the deployment turned two-factor off', async () => {
    const harness = createHarness(false);

    const outcome = await harness.service.completeSignIn(
      userWith(true),
      MOCK_RESPONSE,
    );

    expect(outcome.requiresTwoFactor).toBe(false);
    expect(harness.challengeService.issue).not.toHaveBeenCalled();
    expect(harness.sessionService.createSession).toHaveBeenCalled();
  });

  it('should create the session even for an account that owes a code', async () => {
    const harness = createHarness();

    const summary = await harness.service.issueSession(
      userWith(true),
      MOCK_RESPONSE,
    );

    expect(summary.email).toBe('user@example.com');
    expect(harness.sessionCookieService.set).toHaveBeenCalled();
    expect(harness.challengeService.issue).not.toHaveBeenCalled();
  });
});
