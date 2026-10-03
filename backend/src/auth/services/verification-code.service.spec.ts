import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { VerificationCodeService } from './verification-code.service';
import { PendingRegistration } from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { Clock } from '../../common/services/clock';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { rejectionOf } from '../../../test/utils/rejection';
import { FrozenClock, TEST_NOW } from '../../../test/utils/frozen-clock';

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;
  let pendingRegistrationModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    updateOne: jest.Mock;
    findOneAndUpdate: jest.Mock;
    findOneAndDelete: jest.Mock;
    deleteOne: jest.Mock;
  };
  let hashService: {
    hash: jest.Mock;
    compare: jest.Mock;
    spendComparison: jest.Mock;
  };

  beforeEach(async () => {
    pendingRegistrationModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      updateOne: jest.fn().mockResolvedValue(undefined),
      findOneAndUpdate: jest.fn(),
      findOneAndDelete: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };

    hashService = {
      hash: jest.fn().mockResolvedValue('new-hashed-code'),
      compare: jest.fn(),
      spendComparison: jest.fn().mockResolvedValue(undefined),
    };

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
        { provide: HashService, useValue: hashService },
        { provide: ConfigService, useValue: configService },
        { provide: Clock, useValue: new FrozenClock(TEST_NOW) },
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
  });

  describe('resendActivationCode', () => {
    it('should reissue a code for a live record and keep its stored name', async () => {
      pendingRegistrationModel.findOneAndUpdate.mockResolvedValue({
        name: 'Test User',
      });

      const result = await service.resendActivationCode('user@example.com');

      expect(result).toEqual({
        code: expect.stringMatching(/^\d{6}$/) as string,
        name: 'Test User',
      });
      expect(hashService.hash).toHaveBeenCalledTimes(1);
      expect(pendingRegistrationModel.deleteOne).not.toHaveBeenCalled();
    });

    it('should only refresh a record that is still live', async () => {
      pendingRegistrationModel.findOneAndUpdate.mockResolvedValue(null);

      await expect(
        service.resendActivationCode('user@example.com'),
      ).resolves.toBeNull();

      expect(pendingRegistrationModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          email: { $eq: 'user@example.com' },
          expiresAt: { $gt: expect.any(Date) as Date },
        },
        {
          $set: {
            hashedCode: 'new-hashed-code',
            attempts: 0,
            expiresAt: expect.any(Date) as Date,
          },
        },
        { new: true, select: 'name' },
      );
    });
  });

  describe('verifyAndConsumeRegistration atomic reservation', () => {
    it('should reserve an attempt before comparing an invalid code', async () => {
      hashService.compare.mockResolvedValue(false);
      pendingRegistrationModel.findOneAndUpdate.mockResolvedValue({
        _id: 'pending-id',
        hashedCode: 'hashed-code',
        attempts: 2,
      });

      const rejection = await rejectionOf(
        service.verifyAndConsumeRegistration('user@example.com', 'wrong-code'),
      );

      expect(rejection.getCode()).toBe(ErrorCode.ACTIVATION_CODE_INVALID);
      expect(rejection.getStatus()).toBe(400);
      expect(rejection.getDetails()).toBeUndefined();

      expect(pendingRegistrationModel.findOneAndUpdate).toHaveBeenCalledWith(
        {
          email: { $eq: 'user@example.com' },
          expiresAt: { $gt: expect.any(Date) as Date },
          attempts: { $lt: 5 },
        },
        { $inc: { attempts: 1 } },
        { new: true, select: '+hashedPassword +hashedCode' },
      );
    });

    it('should consume only the hashed generation that was compared', async () => {
      hashService.compare.mockResolvedValue(true);
      pendingRegistrationModel.findOneAndUpdate.mockResolvedValue({
        _id: 'pending-id',
        email: 'user@example.com',
        name: 'Test User',
        hashedPassword: 'hashed-password',
        hashedCode: 'hashed-code',
        attempts: 1,
      });
      pendingRegistrationModel.findOneAndDelete.mockResolvedValue({
        _id: 'pending-id',
      });

      await expect(
        service.verifyAndConsumeRegistration('user@example.com', '123456'),
      ).resolves.toEqual({
        email: 'user@example.com',
        name: 'Test User',
        hashedPassword: 'hashed-password',
      });

      expect(pendingRegistrationModel.findOneAndDelete).toHaveBeenCalledWith({
        _id: 'pending-id',
        hashedCode: 'hashed-code',
        expiresAt: { $gt: expect.any(Date) as Date },
      });
    });

    it('should refuse a stale compare after the code was reissued', async () => {
      hashService.compare.mockResolvedValue(true);
      pendingRegistrationModel.findOneAndUpdate.mockResolvedValue({
        _id: 'pending-id',
        hashedCode: 'old-hash',
        attempts: 1,
      });
      pendingRegistrationModel.findOneAndDelete.mockResolvedValue(null);

      await expect(
        service.verifyAndConsumeRegistration('user@example.com', '123456'),
      ).rejects.toMatchObject({
        code: ErrorCode.ACTIVATION_CODE_INVALID,
      });
    });
  });
});
