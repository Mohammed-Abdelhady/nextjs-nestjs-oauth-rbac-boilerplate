import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminEmailChangeService } from './admin-email-change.service';
import { VerificationCodeService } from '../../auth/services/verification-code.service';
import { MailService } from '../../mail/mail.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ADMIN_LEVEL, ROLE_HIERARCHY } from '../../common/utils/role-hierarchy';

describe('AdminEmailChangeService', () => {
  let service: AdminEmailChangeService;

  const mockUserModel = { findOne: jest.fn() };

  const mockVerificationCodeService = {
    createOrUpdatePendingRegistration: jest
      .fn()
      .mockResolvedValue({ code: '123456', name: 'Target User' }),
  };

  const mockMailService = {
    sendActivationCode: jest.fn().mockResolvedValue(undefined),
  };

  function buildTarget(): UserDocument {
    return {
      _id: new Types.ObjectId(),
      email: 'old@example.com',
      name: 'Target User',
      role: 'user',
      isVerified: true,
    } as unknown as UserDocument;
  }

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEmailChangeService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        {
          provide: VerificationCodeService,
          useValue: mockVerificationCodeService,
        },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AdminEmailChangeService>(AdminEmailChangeService);
    jest.clearAllMocks();
    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    mockVerificationCodeService.createOrUpdatePendingRegistration.mockResolvedValue(
      { code: '123456', name: 'Target User' },
    );
  });

  it('should refuse an actor below admin level', async () => {
    const target = buildTarget();

    await expect(
      service.apply(target, 'new@example.com', ROLE_HIERARCHY.manager),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_CHANGE_NOT_ALLOWED });
    expect(target.email).toBe('old@example.com');
    expect(target.isVerified).toBe(true);
  });

  it('should refuse an address already in use', async () => {
    mockUserModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ email: 'new@example.com' }),
    });
    const target = buildTarget();

    await expect(
      service.apply(target, 'new@example.com', ADMIN_LEVEL),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_ALREADY_EXISTS });
  });

  it('should move the address, drop verification and mail a code', async () => {
    const target = buildTarget();

    await service.apply(target, 'new@example.com', ADMIN_LEVEL);

    expect(target.email).toBe('new@example.com');
    expect(target.isVerified).toBe(false);
    expect(
      mockVerificationCodeService.createOrUpdatePendingRegistration,
    ).toHaveBeenCalledWith('new@example.com', 'Target User');
    expect(mockMailService.sendActivationCode).toHaveBeenCalledWith(
      'new@example.com',
      '123456',
      'Target User',
    );
  });

  it('should leave the account untouched when the mail fails', async () => {
    mockMailService.sendActivationCode.mockRejectedValueOnce(
      new Error('smtp down'),
    );
    const target = buildTarget();

    await expect(
      service.apply(target, 'new@example.com', ADMIN_LEVEL),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_SEND_FAILED });
    expect(target.email).toBe('old@example.com');
    expect(target.isVerified).toBe(true);
  });
});
