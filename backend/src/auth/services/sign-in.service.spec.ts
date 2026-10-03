import { ConfigService } from '@nestjs/config'; // feature:totp
import { Types } from 'mongoose';
import { SignInService } from './sign-in.service';
import { SessionService } from './session.service';
import { SessionCookieService } from './session-cookie.service';
import { AuthFeaturesService } from './auth-features.service'; // feature:totp
import { TwoFactorChallengeService } from '../two-factor/services/two-factor-challenge.service'; // feature:totp
import { UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';
import {
  createModelMock,
  createResponseMock,
  partialMock,
} from '../../common/testing/test-doubles.harness-spec';

const USER_ID = new Types.ObjectId('507f1f77bcf86cd799439011');

const MOCK_RESPONSE = createResponseMock({
  req: { headers: { 'user-agent': 'test-agent' }, ip: '127.0.0.1' },
  setHeader: jest.fn(),
});

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

  const createSession = jest.fn().mockResolvedValue({
    sessionToken: 'session-token-123',
    csrfToken: 'csrf-token-123',
  });
  const sessionService = partialMock<SessionService>({ createSession });
  const set = jest.fn();
  const sessionCookieService = partialMock<SessionCookieService>({ set });
  // feature:totp:start
  const issue = jest.fn().mockResolvedValue(undefined);
  const challengeService = partialMock<TwoFactorChallengeService>({ issue });

  const configService = new ConfigService({ 'twoFactor.enabled': true });
  // feature:totp:end

  return {
    service: new SignInService(
      createModelMock<ConstructorParameters<typeof SignInService>[0]>(
        roleModel,
      ),
      sessionService,
      sessionCookieService,
      new AuthFeaturesService(configService), // feature:totp
      challengeService, // feature:totp
    ),
    sessionService: { createSession },
    sessionCookieService: { set },
    challengeService: { issue }, // feature:totp
  };
}

function plainUser(): UserDocument {
  const draft = {
    _id: USER_ID,
    email: 'user@example.com',
    name: 'Test User',
    role: 'user',
    permissions: [],
    authProvider: AuthProvider.EMAIL,
    isVerified: true,
    isDeleted: false,
    twoFactor: {
      enabled: false,
      secret: null,
      confirmedAt: null,
      recoveryCodes: [],
      lastUsedStep: null,
    },
  };
  return partialMock<UserDocument>(draft);
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
