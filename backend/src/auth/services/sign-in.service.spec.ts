import { ConfigService } from '@nestjs/config'; // feature:totp
import { Response } from 'express';
import { Types } from 'mongoose';
import { SignInService } from './sign-in.service';
import { SessionService } from './session.service';
import { SessionCookieService } from './session-cookie.service';
import { AuthFeaturesService } from './auth-features.service'; // feature:totp
import { TwoFactorChallengeService } from '../two-factor/services/two-factor-challenge.service'; // feature:totp
import { UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';

const USER_ID = new Types.ObjectId('507f1f77bcf86cd799439011');

const MOCK_RESPONSE = {
  req: { headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' },
} as unknown as Response;

interface Harness {
  service: SignInService;
  sessionService: { createSession: jest.Mock };
  sessionCookieService: { set: jest.Mock };
  challengeService: { issue: jest.Mock }; // feature:totp
}

function createHarness(): Harness {
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
  // feature:totp:start
  const challengeService = { issue: jest.fn().mockResolvedValue(undefined) };

  const configService = {
    get: <T>(key: string, fallback?: T): T | undefined =>
      key === 'twoFactor.enabled' ? (true as T) : fallback,
  } as unknown as ConfigService;
  // feature:totp:end

  return {
    service: new SignInService(
      roleModel as unknown as ConstructorParameters<typeof SignInService>[0],
      sessionService as unknown as SessionService,
      sessionCookieService as unknown as SessionCookieService,
      new AuthFeaturesService(configService), // feature:totp
      challengeService as unknown as TwoFactorChallengeService, // feature:totp
    ),
    sessionService,
    sessionCookieService,
    challengeService, // feature:totp
  };
}

function plainUser(): UserDocument {
  return {
    _id: USER_ID,
    email: 'user@example.com',
    name: 'Test User',
    role: 'user',
    permissions: [],
    authProvider: AuthProvider.EMAIL,
    isVerified: true,
    isDeleted: false,
    twoFactor: { enabled: false },
  } as unknown as UserDocument;
}

describe('SignInService', () => {
  describe('completeSignIn', () => {
    it('should create the session for an account without a second factor', async () => {
      const harness = createHarness();

      const outcome = await harness.service.completeSignIn(
        plainUser(),
        MOCK_RESPONSE,
      );

      expect(outcome).toEqual({
        requiresTwoFactor: false,
        user: expect.objectContaining({
          email: 'user@example.com',
          permissions: ['read'],
        }) as unknown,
      });
      expect(harness.sessionService.createSession).toHaveBeenCalledWith(
        USER_ID,
        'test-agent',
        '127.0.0.1',
      );
      expect(harness.sessionCookieService.set).toHaveBeenCalledWith(
        MOCK_RESPONSE,
        'session-token-123',
      );
      expect(harness.challengeService.issue).not.toHaveBeenCalled(); // feature:totp
    });
  });

  describe('issueSession', () => {
    it('should create the session and set its cookie', async () => {
      const harness = createHarness();

      const summary = await harness.service.issueSession(
        plainUser(),
        MOCK_RESPONSE,
      );

      expect(summary.email).toBe('user@example.com');
      expect(harness.sessionCookieService.set).toHaveBeenCalled();
    });
  });
});
