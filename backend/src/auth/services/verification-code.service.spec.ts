import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { VerificationCodeService } from './verification-code.service';
import { PendingRegistration } from '../schemas/pending-registration.schema';
import { PendingPasswordReset } from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('VerificationCodeService (D-05)', () => {
  let service: VerificationCodeService;
  let pendingRegistrationModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };
  let pendingPasswordResetModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };
  let hashService: jest.Mocked<HashService>;

  const mockPendingRegistration = {
    email: 'user@example.com',
    name: 'Test User',
    hashedPassword: 'hashed-password',
    hashedCode: 'hashed-code',
    attempts: 0,
    expiresAt: new Date(Date.now() + 60000),
    save: jest.fn().mockResolvedValue(undefined),
  };

  const mockPendingPasswordReset = {
    email: 'user@example.com',
    hashedCode: 'hashed-code',
    attempts: 0,
    expiresAt: new Date(Date.now() + 60000),
    save: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    pendingRegistrationModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };

    pendingPasswordResetModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };

    hashService = {
      hash: jest.fn().mockResolvedValue('hashed-code'),
      compare: jest.fn(),
    } as unknown as jest.Mocked<HashService>;

    const configService = {
      get: jest.fn((key: string, defaultValue?: number) => {
        if (key === 'activation.maxAttempts') return 5;
        if (key === 'activation.codeExpiresIn') return 900000;
        return defaultValue;
      }),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        {
          provide: getModelToken(PendingRegistration.name),
          useValue: pendingRegistrationModel,
        },
        {
          provide: getModelToken(PendingPasswordReset.name),
          useValue: pendingPasswordResetModel,
        },
        { provide: HashService, useValue: hashService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
  });

  describe('verifyAndConsumeRegistration atomic increment', () => {
    it('should atomically increment attempts via findOneAndUpdate on invalid code', async () => {
      pendingRegistrationModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockPendingRegistration,
          attempts: 1,
        }),
      });
      hashService.compare.mockResolvedValue(false);
      pendingRegistrationModel.findOneAndUpdate.mockResolvedValue({
        attempts: 2,
      });

      await expect(
        service.verifyAndConsumeRegistration('user@example.com', 'wrong-code'),
      ).rejects.toMatchObject({
        code: ErrorCode.ACTIVATION_CODE_INVALID,
        status: 400,
        details: { remainingAttempts: 3 },
      });

      expect(pendingRegistrationModel.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'user@example.com' },
        { $inc: { attempts: 1 } },
        { new: true },
      );
    });
  });

  describe('verifyPasswordReset atomic increment', () => {
    it('should atomically increment attempts via findOneAndUpdate on invalid reset code', async () => {
      pendingPasswordResetModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          ...mockPendingPasswordReset,
          attempts: 2,
        }),
      });
      hashService.compare.mockResolvedValue(false);
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue({
        attempts: 3,
      });

      await expect(
        service.verifyPasswordReset('user@example.com', 'wrong-code'),
      ).rejects.toMatchObject({
        code: ErrorCode.PASSWORD_RESET_CODE_INVALID,
        status: 400,
        details: { remainingAttempts: 2 },
      });

      expect(pendingPasswordResetModel.findOneAndUpdate).toHaveBeenCalledWith(
        { email: 'user@example.com' },
        { $inc: { attempts: 1 } },
        { new: true },
      );
    });
  });
});
