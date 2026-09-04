import {
  AuthServiceHarness,
  createAuthServiceHarness,
  MOCK_RESPONSE,
  MOCK_USER,
  MOCK_USER_ID,
} from './auth.service.harness-spec';
import { ErrorCode } from '../common/enums/error-code.enum';

describe('AuthService sign-in and password reset', () => {
  let harness: AuthServiceHarness;

  beforeEach(async () => {
    harness = await createAuthServiceHarness();
  });

  describe('login (S-01 and D-04)', () => {
    it('should reject login with 401 when user is deleted', async () => {
      harness.userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await expect(
        harness.service.login(
          { email: 'deleted@example.com', password: 'Password123!' },
          MOCK_RESPONSE,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
        status: 401,
      });

      expect(harness.userModel.findOne).toHaveBeenCalledWith({
        email: 'deleted@example.com',
        isDeleted: { $ne: true },
      });
      expect(harness.hashService.compare).not.toHaveBeenCalled();
    });

    it('should reject login with 401 when account has no password (OAuth-only)', async () => {
      harness.userModel.findOne.mockReturnValue({
        select: jest
          .fn()
          .mockResolvedValue({ ...MOCK_USER, password: undefined }),
      });

      await expect(
        harness.service.login(
          { email: 'oauth@example.com', password: 'Password123!' },
          MOCK_RESPONSE,
        ),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_CREDENTIALS,
        status: 401,
      });

      expect(harness.hashService.compare).not.toHaveBeenCalled();
    });

    it('should authenticate user and create session on valid credentials', async () => {
      harness.userModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(MOCK_USER),
      });
      harness.hashService.compare.mockResolvedValue(true);

      const result = await harness.service.login(
        { email: 'user@example.com', password: 'Password123!' },
        MOCK_RESPONSE,
      );

      expect(result.success).toBe(true);
      expect(harness.sessionService.createSession).toHaveBeenCalledWith(
        MOCK_USER_ID,
        'test-agent',
        '127.0.0.1',
      );
      expect(harness.sessionCookieService.set).toHaveBeenCalledWith(
        MOCK_RESPONSE,
        'session-token-123',
      );
    });
  });

  describe('resetPassword (S-07)', () => {
    it('should invalidate all sessions on successful resetPassword', async () => {
      harness.userModel.findOne.mockResolvedValue(MOCK_USER);
      harness.hashService.hash.mockResolvedValue('new-hashed-password');

      const result = await harness.service.resetPassword({
        email: 'user@example.com',
        code: '123456',
        newPassword: 'NewPassword123!',
      });

      expect(result.success).toBe(true);
      expect(harness.sessionService.invalidateAllSessions).toHaveBeenCalledWith(
        MOCK_USER_ID,
      );
      expect(
        harness.passwordResetCodeService.clearPasswordReset,
      ).toHaveBeenCalledWith('user@example.com');
    });

    it('should reject a reset for an address without an account', async () => {
      harness.userModel.findOne.mockResolvedValue(null);

      await expect(
        harness.service.resetPassword({
          email: 'nobody@example.com',
          code: '123456',
          newPassword: 'NewPassword123!',
        }),
      ).rejects.toMatchObject({
        code: ErrorCode.USER_NOT_FOUND_FOR_RESET,
        status: 404,
      });
    });
  });
});
