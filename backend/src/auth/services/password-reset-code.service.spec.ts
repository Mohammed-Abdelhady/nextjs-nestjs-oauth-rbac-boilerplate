import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { PasswordResetCodeService } from './password-reset-code.service';
import { PendingPasswordReset } from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('PasswordResetCodeService', () => {
  let service: PasswordResetCodeService;
  let pendingPasswordResetModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
    deleteOne: jest.Mock;
  };
  let hashService: jest.Mocked<HashService>;

  const mockPendingPasswordReset = {
    email: 'user@example.com',
    hashedCode: 'hashed-code',
    attempts: 0,
    expiresAt: new Date(Date.now() + 60000),
    save: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    pendingPasswordResetModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
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
        PasswordResetCodeService,
        {
          provide: getModelToken(PendingPasswordReset.name),
          useValue: pendingPasswordResetModel,
        },
        { provide: HashService, useValue: hashService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<PasswordResetCodeService>(PasswordResetCodeService);
  });

  describe('createOrUpdatePasswordReset', () => {
    it('should create a record when none is pending', async () => {
      pendingPasswordResetModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      const code =
        await service.createOrUpdatePasswordReset('user@example.com');

      expect(code).toMatch(/^\d{6}$/);
      expect(pendingPasswordResetModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@example.com',
          hashedCode: 'hashed-code',
          attempts: 0,
        }),
      );
    });

    it('should replace the code of an existing record', async () => {
      const existing = {
        ...mockPendingPasswordReset,
        attempts: 3,
        hashedCode: 'previous-code',
        save: jest.fn().mockResolvedValue(undefined),
      };
      pendingPasswordResetModel.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(existing),
      });

      await service.createOrUpdatePasswordReset('user@example.com');

      expect(existing.hashedCode).toBe('hashed-code');
      expect(existing.attempts).toBe(0);
      expect(existing.save).toHaveBeenCalled();
      expect(pendingPasswordResetModel.create).not.toHaveBeenCalled();
    });
  });

  describe('verifyPasswordReset atomic reservation', () => {
    it('should reserve an attempt before comparing an invalid code', async () => {
      hashService.compare.mockResolvedValue(false);
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue({
        _id: 'reset-id',
        hashedCode: 'hashed-code',
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
        {
          email: { $eq: 'user@example.com' },
          expiresAt: { $gt: expect.any(Date) as Date },
          attempts: { $lt: 5 },
        },
        { $inc: { attempts: 1 } },
        { new: true, select: '+hashedCode' },
      );
    });

    it('should drop an expired record and report the expiry', async () => {
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue(null);
      pendingPasswordResetModel.findOne.mockResolvedValue({
        _id: 'reset-id',
        expiresAt: new Date(Date.now() - 1000),
      });

      await expect(
        service.verifyPasswordReset('user@example.com', '123456'),
      ).rejects.toMatchObject({
        code: ErrorCode.PASSWORD_RESET_CODE_EXPIRED,
      });
      expect(pendingPasswordResetModel.deleteOne).toHaveBeenCalledWith({
        _id: 'reset-id',
      });
    });

    it('should return the reserved generation for a valid code', async () => {
      hashService.compare.mockResolvedValue(true);
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue({
        _id: 'reset-id',
        hashedCode: 'hashed-code',
        attempts: 1,
      });

      await expect(
        service.verifyPasswordReset('user@example.com', '123456'),
      ).resolves.toEqual({
        id: 'reset-id',
        hashedCode: 'hashed-code',
      });
    });
  });

  describe('consumePasswordReset', () => {
    it('should delete only the hashed generation that was compared', async () => {
      pendingPasswordResetModel.findOneAndDelete.mockResolvedValue({
        _id: 'reset-id',
      });

      await expect(
        service.consumePasswordReset('reset-id' as never, 'hashed-code'),
      ).resolves.toBe(true);
      expect(pendingPasswordResetModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'reset-id',
        hashedCode: 'hashed-code',
        expiresAt: { $gt: expect.any(Date) as Date },
      });
    });

    it('should report a lost race when the generation is already gone', async () => {
      pendingPasswordResetModel.findOneAndDelete.mockResolvedValue(null);

      await expect(
        service.consumePasswordReset('reset-id' as never, 'hashed-code'),
      ).resolves.toBe(false);
    });
  });
});
