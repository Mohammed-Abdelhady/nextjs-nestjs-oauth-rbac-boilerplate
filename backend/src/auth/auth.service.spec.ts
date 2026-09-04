import {
  AuthServiceHarness,
  createAuthServiceHarness,
  MOCK_USER,
  REGISTER_DTO,
} from './auth.service.harness-spec';
import { GENERIC_CODE_SENT_MESSAGE } from './constants/auth-messages';

describe('AuthService registration and code requests', () => {
  let harness: AuthServiceHarness;

  beforeEach(async () => {
    harness = await createAuthServiceHarness();
  });

  describe('register (S-09 and S-13)', () => {
    it('should answer a free address with the generic reply and mail a code', async () => {
      harness.userModel.findOne.mockResolvedValue(null);

      const result = await harness.service.register(REGISTER_DTO);

      expect(result.success).toBe(true);
      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(harness.authMailService.sendActivationCode).toHaveBeenCalledWith(
        'user@example.com',
        '123456',
        'Test User',
      );
    });

    it('should answer a taken address with the same reply and notify its owner', async () => {
      harness.userModel.findOne.mockResolvedValue(MOCK_USER);

      const result = await harness.service.register({
        ...REGISTER_DTO,
        name: 'Impostor',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(
        harness.authMailService.sendRegistrationAttemptNotice,
      ).toHaveBeenCalledWith('user@example.com', 'Test User');
      expect(harness.authMailService.sendActivationCode).not.toHaveBeenCalled();
      expect(
        harness.verificationCodeService.createOrUpdatePendingRegistration,
      ).not.toHaveBeenCalled();
    });

    it('should hash a password for a taken address so both paths cost the same', async () => {
      harness.userModel.findOne.mockResolvedValue(MOCK_USER);

      await harness.service.register(REGISTER_DTO);

      expect(harness.hashService.hash).toHaveBeenCalledTimes(2);
    });

    it('should mail the name held by a live pending registration, not the new one', async () => {
      harness.userModel.findOne.mockResolvedValue(null);
      harness.verificationCodeService.createOrUpdatePendingRegistration.mockResolvedValue(
        { code: '111111', name: 'First Registrant' },
      );

      await harness.service.register({
        ...REGISTER_DTO,
        name: 'Second Registrant',
      });

      expect(harness.authMailService.sendActivationCode).toHaveBeenCalledWith(
        'user@example.com',
        '111111',
        'First Registrant',
      );
    });

    it('should still register an address whose account is not verified yet', async () => {
      harness.userModel.findOne.mockResolvedValue({
        ...MOCK_USER,
        isVerified: false,
      });

      await harness.service.register(REGISTER_DTO);

      expect(
        harness.verificationCodeService.createOrUpdatePendingRegistration,
      ).toHaveBeenCalledWith(
        'user@example.com',
        'Test User',
        expect.any(String),
      );
      expect(
        harness.authMailService.sendRegistrationAttemptNotice,
      ).not.toHaveBeenCalled();
    });
  });

  describe('resendActivation (S-01 and S-13)', () => {
    it('should answer a verified account with the generic reply and no mail', async () => {
      harness.userModel.findOne.mockResolvedValue(MOCK_USER);

      const result = await harness.service.resendActivation({
        email: 'user@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(harness.hashService.hash).toHaveBeenCalledTimes(1);
      expect(harness.authMailService.sendActivationCode).not.toHaveBeenCalled();
      expect(
        harness.verificationCodeService.resendActivationCode,
      ).not.toHaveBeenCalled();
    });

    it('should answer an address with nothing pending the same way', async () => {
      harness.userModel.findOne.mockResolvedValue(null);
      harness.verificationCodeService.resendActivationCode.mockResolvedValue(
        null,
      );

      const result = await harness.service.resendActivation({
        email: 'nobody@example.com',
      });

      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(harness.hashService.hash).toHaveBeenCalledTimes(1);
      expect(harness.authMailService.sendActivationCode).not.toHaveBeenCalled();
    });

    it('should mail a fresh code to an account still waiting to be verified', async () => {
      harness.userModel.findOne.mockResolvedValue({
        ...MOCK_USER,
        isVerified: false,
      });

      const result = await harness.service.resendActivation({
        email: 'user@example.com',
      });

      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(harness.authMailService.sendActivationCode).toHaveBeenCalledWith(
        'user@example.com',
        '654321',
        'Test User',
      );
    });
  });

  describe('forgotPassword (S-01 and S-13)', () => {
    it('should answer an unknown address with the generic reply and no mail', async () => {
      harness.userModel.findOne.mockResolvedValue(null);

      const result = await harness.service.forgotPassword({
        email: 'nobody@example.com',
      });

      expect(result.success).toBe(true);
      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(harness.hashService.hash).toHaveBeenCalledTimes(1);
      expect(
        harness.authMailService.sendPasswordResetCode,
      ).not.toHaveBeenCalled();
      expect(harness.userModel.findOne).toHaveBeenCalledWith({
        email: 'nobody@example.com',
        isDeleted: { $ne: true },
      });
    });

    it('should answer a known address the same way and mail a code', async () => {
      harness.userModel.findOne.mockResolvedValue(MOCK_USER);

      const result = await harness.service.forgotPassword({
        email: 'user@example.com',
      });

      expect(result.message).toBe(GENERIC_CODE_SENT_MESSAGE);
      expect(
        harness.authMailService.sendPasswordResetCode,
      ).toHaveBeenCalledWith('user@example.com', '123456', 'Test User');
    });
  });
});
