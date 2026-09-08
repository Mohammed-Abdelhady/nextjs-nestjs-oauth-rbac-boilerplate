import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { VerificationCodeService } from './verification-code.service';
import { PendingRegistration } from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('VerificationCodeService', () => {
  let service: VerificationCodeService;
  let pendingRegistrationModel: {
    findOne: jest.Mock;
    create: jest.Mock;
    findOneAndUpdate: jest.Mock;
    deleteOne: jest.Mock;
  };
  let hashService: { hash: jest.Mock; compare: jest.Mock };

  const mockPendingRegistration = {
    email: 'user@example.com',
    name: 'Test User',
    hashedPassword: 'hashed-password',
    hashedCode: 'hashed-code',
    attempts: 0,
    expiresAt: new Date(Date.now() + 60000),
    save: jest.fn().mockResolvedValue(undefined),
  };

  function pending(overrides: Record<string, unknown> = {}) {
    return {
      ...mockPendingRegistration,
      save: jest.fn().mockResolvedValue(undefined),
      ...overrides,
    };
  }

  function selecting(value: unknown): { select: jest.Mock } {
    return { select: jest.fn().mockResolvedValue(value) };
  }

  beforeEach(async () => {
    pendingRegistrationModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      findOneAndUpdate: jest.fn(),
      deleteOne: jest.fn().mockResolvedValue(undefined),
    };

    hashService = {
      hash: jest.fn().mockResolvedValue('new-hashed-code'),
      compare: jest.fn(),
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
      ],
    }).compile();

    service = module.get<VerificationCodeService>(VerificationCodeService);
  });

  describe('createOrUpdatePendingRegistration (S-09)', () => {
    it('should keep the stored name and password while the record is live', async () => {
      const existing = pending();
      pendingRegistrationModel.findOne.mockReturnValue(selecting(existing));

      const result = await service.createOrUpdatePendingRegistration(
        'user@example.com',
        'Second Registrant',
        'second-password-hash',
      );

      expect(existing.name).toBe('Test User');
      expect(existing.hashedPassword).toBe('hashed-password');
      expect(existing.hashedCode).toBe('new-hashed-code');
      expect(existing.attempts).toBe(0);
      expect(existing.save).toHaveBeenCalled();
      expect(pendingRegistrationModel.create).not.toHaveBeenCalled();
      expect(result.name).toBe('Test User');
      expect(result.code).toMatch(/^\d{6}$/);
    });

    it('should extend the expiry of a live record', async () => {
      const expiresAt = new Date(Date.now() + 60000);
      const existing = pending({ expiresAt });
      pendingRegistrationModel.findOne.mockReturnValue(selecting(existing));

      await service.createOrUpdatePendingRegistration(
        'user@example.com',
        'Second Registrant',
        'second-password-hash',
      );

      expect(existing.expiresAt.getTime()).toBeGreaterThan(expiresAt.getTime());
    });

    it('should replace an expired record with the new details', async () => {
      const existing = pending({
        expiresAt: new Date(Date.now() - 1000),
      });
      pendingRegistrationModel.findOne.mockReturnValue(selecting(existing));

      const result = await service.createOrUpdatePendingRegistration(
        'user@example.com',
        'Second Registrant',
        'second-password-hash',
      );

      expect(existing.name).toBe('Second Registrant');
      expect(existing.hashedPassword).toBe('second-password-hash');
      expect(existing.save).toHaveBeenCalled();
      expect(result.name).toBe('Second Registrant');
    });

    it('should create a record when nothing is pending', async () => {
      pendingRegistrationModel.findOne.mockReturnValue(selecting(null));

      const result = await service.createOrUpdatePendingRegistration(
        'new@example.com',
        'New User',
        'password-hash',
      );

      expect(pendingRegistrationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new@example.com',
          name: 'New User',
          hashedPassword: 'password-hash',
          attempts: 0,
        }),
      );
      expect(result.name).toBe('New User');
    });
  });

  describe('resendActivationCode', () => {
    it('should reissue a code for a live record without touching its details', async () => {
      const existing = pending();
      pendingRegistrationModel.findOne.mockReturnValue(selecting(existing));

      const result = await service.resendActivationCode('user@example.com');

      expect(result).toEqual({
        code: expect.stringMatching(/^\d{6}$/) as string,
        name: 'Test User',
      });
      expect(existing.hashedPassword).toBe('hashed-password');
      expect(existing.hashedCode).toBe('new-hashed-code');
    });

    it('should return null when nothing is pending', async () => {
      pendingRegistrationModel.findOne.mockReturnValue(selecting(null));

      await expect(
        service.resendActivationCode('nobody@example.com'),
      ).resolves.toBeNull();
      expect(hashService.hash).not.toHaveBeenCalled();
    });

    it('should drop an expired record instead of reviving it', async () => {
      pendingRegistrationModel.findOne.mockReturnValue(
        selecting(pending({ expiresAt: new Date(Date.now() - 1000) })),
      );

      await expect(
        service.resendActivationCode('user@example.com'),
      ).resolves.toBeNull();
      expect(pendingRegistrationModel.deleteOne).toHaveBeenCalledWith({
        email: 'user@example.com',
      });
    });
  });

  describe('verifyAndConsumeRegistration atomic increment (D-05)', () => {
    it('should atomically increment attempts via findOneAndUpdate on invalid code', async () => {
      pendingRegistrationModel.findOne.mockReturnValue(
        selecting(pending({ attempts: 1 })),
      );
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
});
