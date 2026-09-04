import { ErrorCode } from '../../common/enums/error-code.enum';
import { MAGIC_LINK_SENT_MESSAGE } from './constants/magic-link.constants';
import { hashMagicLinkToken } from './utils/magic-link-token.util';
import {
  MagicLinkHarness,
  MAGIC_LINK_MAX_PER_HOUR,
  MOCK_REQUEST,
  MOCK_RESPONSE,
  MOCK_USER,
  createMagicLinkHarness,
} from './magic-link.harness-spec';

const EMAIL = 'user@example.com';
const TOKEN = 'a-token-from-the-mailed-link';

describe('MagicLinkService', () => {
  let harness: MagicLinkHarness;

  beforeEach(async () => {
    harness = await createMagicLinkHarness();
  });

  describe('request', () => {
    it('should mail a link for an address without an account', async () => {
      const result = await harness.service.request(
        { email: EMAIL },
        MOCK_REQUEST,
      );

      expect(harness.pendingModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: EMAIL,
          tokenHash: expect.stringMatching(/^[0-9a-f]{64}$/) as string,
          consumedAt: null,
          requestIp: '127.0.0.1',
          userAgent: 'test-agent',
        }),
      );
      expect(harness.authMailService.sendMagicLink).toHaveBeenCalledWith(
        EMAIL,
        expect.stringContaining(
          'http://localhost:3000/auth/magic-link/verify?token=',
        ) as string,
        15,
      );
      expect(result.data.email).toBe(EMAIL);
      expect(result.message).toBe(MAGIC_LINK_SENT_MESSAGE);
    });

    it('should answer a known address the same way it answers an unknown one', async () => {
      const unknown = await harness.service.request(
        { email: EMAIL },
        MOCK_REQUEST,
      );

      harness.userModel.findOne.mockResolvedValueOnce(MOCK_USER);
      const known = await harness.service.request(
        { email: EMAIL },
        MOCK_REQUEST,
      );

      expect(known).toEqual(unknown);
    });

    it('should send nothing for a soft-deleted account and answer the same way', async () => {
      harness.userModel.findOne.mockResolvedValueOnce({
        ...MOCK_USER,
        isDeleted: true,
      });

      const result = await harness.service.request(
        { email: EMAIL },
        MOCK_REQUEST,
      );

      expect(harness.pendingModel.create).not.toHaveBeenCalled();
      expect(harness.authMailService.sendMagicLink).not.toHaveBeenCalled();
      expect(result.data.email).toBe(EMAIL);
      expect(result.message).toBe(MAGIC_LINK_SENT_MESSAGE);
    });

    it('should stop mailing once the address hits the hourly cap', async () => {
      harness.pendingModel.countDocuments.mockResolvedValueOnce(
        MAGIC_LINK_MAX_PER_HOUR,
      );

      const result = await harness.service.request(
        { email: EMAIL },
        MOCK_REQUEST,
      );

      expect(harness.pendingModel.countDocuments).toHaveBeenCalledWith({
        email: EMAIL,
        createdAt: { $gte: expect.any(Date) as Date },
      });
      expect(harness.pendingModel.create).not.toHaveBeenCalled();
      expect(harness.authMailService.sendMagicLink).not.toHaveBeenCalled();
      expect(result.message).toBe(MAGIC_LINK_SENT_MESSAGE);
    });

    it('should keep mailing while the address is under the cap', async () => {
      harness.pendingModel.countDocuments.mockResolvedValueOnce(
        MAGIC_LINK_MAX_PER_HOUR - 1,
      );

      await harness.service.request({ email: EMAIL }, MOCK_REQUEST);

      expect(harness.authMailService.sendMagicLink).toHaveBeenCalledTimes(1);
    });
  });

  describe('verify', () => {
    function pendingLink(expiresAt: Date): {
      email: string;
      expiresAt: Date;
    } {
      return { email: EMAIL, expiresAt };
    }

    it('should spend the link once and sign the account in', async () => {
      harness.pendingModel.findOneAndUpdate.mockResolvedValueOnce(
        pendingLink(new Date(Date.now() + 60000)),
      );
      harness.userModel.findOne.mockResolvedValueOnce(MOCK_USER);

      const result = await harness.service.verify(
        { token: TOKEN },
        MOCK_RESPONSE,
      );

      expect(harness.pendingModel.findOneAndUpdate).toHaveBeenCalledWith(
        { tokenHash: hashMagicLinkToken(TOKEN), consumedAt: null },
        { $set: { consumedAt: expect.any(Date) as Date } },
        { new: true },
      );
      expect(harness.sessionService.createSession).toHaveBeenCalledWith(
        MOCK_USER._id,
        'test-agent',
        '127.0.0.1',
      );
      expect(harness.sessionCookieService.set).toHaveBeenCalledWith(
        MOCK_RESPONSE,
        'session-token-123',
      );
      expect(result.data.user).toMatchObject({
        email: EMAIL,
        permissions: ['read'],
      });
    });

    it('should create a verified account without a password for a new address', async () => {
      harness.pendingModel.findOneAndUpdate.mockResolvedValueOnce(
        pendingLink(new Date(Date.now() + 60000)),
      );

      await harness.service.verify({ token: TOKEN }, MOCK_RESPONSE);

      expect(harness.userModel.create).toHaveBeenCalledWith({
        email: EMAIL,
        name: 'user',
        isVerified: true,
        authProvider: 'email',
        primaryProvider: 'email',
      });
    });

    it('should reject a token that was already spent', async () => {
      harness.pendingModel.findOneAndUpdate.mockResolvedValueOnce(null);

      await expect(
        harness.service.verify({ token: TOKEN }, MOCK_RESPONSE),
      ).rejects.toMatchObject({
        code: ErrorCode.MAGIC_LINK_INVALID,
        status: 400,
      });
      expect(harness.sessionService.createSession).not.toHaveBeenCalled();
    });

    it('should reject an expired token', async () => {
      harness.pendingModel.findOneAndUpdate.mockResolvedValueOnce(
        pendingLink(new Date(Date.now() - 1000)),
      );

      await expect(
        harness.service.verify({ token: TOKEN }, MOCK_RESPONSE),
      ).rejects.toMatchObject({
        code: ErrorCode.MAGIC_LINK_INVALID,
      });
      expect(harness.userModel.findOne).not.toHaveBeenCalled();
    });

    it('should reject a link that belongs to a soft-deleted account', async () => {
      harness.pendingModel.findOneAndUpdate.mockResolvedValueOnce(
        pendingLink(new Date(Date.now() + 60000)),
      );
      harness.userModel.findOne.mockResolvedValueOnce({
        ...MOCK_USER,
        isDeleted: true,
      });

      await expect(
        harness.service.verify({ token: TOKEN }, MOCK_RESPONSE),
      ).rejects.toMatchObject({
        code: ErrorCode.MAGIC_LINK_INVALID,
      });
      expect(harness.sessionCookieService.set).not.toHaveBeenCalled();
    });

    it('should verify an account that had not confirmed its address', async () => {
      const unverified = {
        ...MOCK_USER,
        isVerified: false,
        save: jest.fn().mockResolvedValue(undefined),
      };
      harness.pendingModel.findOneAndUpdate.mockResolvedValueOnce(
        pendingLink(new Date(Date.now() + 60000)),
      );
      harness.userModel.findOne.mockResolvedValueOnce(unverified);

      await harness.service.verify({ token: TOKEN }, MOCK_RESPONSE);

      expect(unverified.isVerified).toBe(true);
      expect(unverified.save).toHaveBeenCalled();
    });
  });
});
