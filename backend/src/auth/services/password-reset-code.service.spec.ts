import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { PasswordResetCodeService } from './password-reset-code.service';
import { PendingPasswordReset } from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { Clock } from '../../common/services/clock';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { rejectionOf } from '../../../test/utils/rejection';
import { FrozenClock, TEST_NOW } from '../../../test/utils/frozen-clock';

describe('PasswordResetCodeService', () => {
  let service: PasswordResetCodeService;
  let pendingPasswordResetModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
    deleteOne: jest.Mock;
  };
  let hashService: jest.Mocked<HashService>;

  beforeEach(async () => {
    pendingPasswordResetModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue(undefined),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };

    hashService = {
      hash: jest.fn().mockResolvedValue('hashed-code'),
      compare: jest.fn(),
      spendComparison: jest.fn().mockResolvedValue(undefined),
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
        { provide: Clock, useValue: new FrozenClock(TEST_NOW) },
      ],
    }).compile();

    service = module.get<PasswordResetCodeService>(PasswordResetCodeService);
  });

  describe('verifyPasswordReset atomic reservation', () => {
    it('should reserve an attempt before comparing an invalid code', async () => {
      hashService.compare.mockResolvedValue(false);
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue({
        _id: 'reset-id',
        hashedCode: 'hashed-code',
        attempts: 3,
      });

      const rejection = await rejectionOf(
        service.verifyPasswordReset('user@example.com', 'wrong-code'),
      );

      expect(rejection.getCode()).toBe(ErrorCode.PASSWORD_RESET_CODE_INVALID);
      expect(rejection.getStatus()).toBe(400);
      expect(rejection.getDetails()).toBeUndefined();

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

    it('should delete an expired record it could not reserve and answer the one code', async () => {
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue(null);

      const rejection = await rejectionOf(
        service.verifyPasswordReset('user@example.com', '123456'),
      );

      expect(rejection.getCode()).toBe(ErrorCode.PASSWORD_RESET_CODE_INVALID);
      expect(rejection.getStatus()).toBe(400);
      expect(rejection.getDetails()).toBeUndefined();
      expect(pendingPasswordResetModel.deleteOne).toHaveBeenCalledWith({
        email: { $eq: 'user@example.com' },
        expiresAt: { $lte: expect.any(Date) as Date },
      });
    });

    it('should answer no record and a locked record the same way', async () => {
      pendingPasswordResetModel.findOneAndUpdate.mockResolvedValue(null);
      pendingPasswordResetModel.findOne.mockReturnValueOnce(null);
      const missing = await rejectionOf(
        service.verifyPasswordReset('nobody@example.com', '123456'),
      );

      pendingPasswordResetModel.findOne.mockReturnValueOnce({
        _id: 'locked-id',
        expiresAt: new Date(TEST_NOW.getTime() + 60000),
        attempts: 5,
      });
      const locked = await rejectionOf(
        service.verifyPasswordReset('user@example.com', '123456'),
      );

      expect({
        code: locked.getCode(),
        status: locked.getStatus(),
        message: locked.message,
        details: locked.getDetails(),
      }).toEqual({
        code: missing.getCode(),
        status: missing.getStatus(),
        message: missing.message,
        details: missing.getDetails(),
      });
      expect(missing.getCode()).toBe(ErrorCode.PASSWORD_RESET_CODE_INVALID);
      expect(missing.getDetails()).toBeUndefined();
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
