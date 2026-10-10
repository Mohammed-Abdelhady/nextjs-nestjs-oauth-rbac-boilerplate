import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, createConnection } from 'mongoose';
import {
  startMemoryReplSet,
  type MemoryReplSet,
} from '../../../../../../test/utils/memory-replset';
import { AdminEmailChangeService } from '../../../../services/users/admin-email-change.service';
import { VerificationCodeService } from '../../../../../auth/services/codes/verification-code.service';
import { AuthMailService } from '../../../../../auth/services/mail/auth-mail.service';
import {
  User,
  UserDocument,
  UserSchema,
} from '../../../../../user/persistence/mongo/schemas/user.schema';
import { ErrorCode } from '../../../../../common/enums/error-code.enum';
import {
  ADMIN_LEVEL,
  ROLE_HIERARCHY,
} from '../../../../../common/utils/role-hierarchy';
import { PENDING_PURPOSE } from '../../../../../auth/constants/registration';
import { Role } from '../../../../../role/persistence/mongo/schemas/role.schema';
import { toStoredAccount } from '../../../../../user/persistence/mongo/mongo-account-records';
import { MONGO_ADMIN_ACCOUNT_STORE } from '../../mongo-admin-stores';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../../../../test/utils/session-authority-harness';

describe('AdminEmailChangeService', () => {
  let mongo: MemoryReplSet;
  let connection: Connection;
  let users: Model<User>;
  let service: AdminEmailChangeService;

  const mockVerificationCodeService = {
    createOrUpdatePendingRegistration: jest
      .fn()
      .mockResolvedValue({ code: '123456' }),
  };

  const mockAuthMailService = {
    sendEmailChangeCode: jest.fn().mockResolvedValue(true),
  };

  const config = {
    get: (key: string, fallback?: number) =>
      key === 'activation.codeExpiresIn' ? 900000 : fallback,
  };

  beforeAll(async () => {
    mongo = await startMemoryReplSet();
    connection = await createConnection(mongo.getUri()).asPromise();
    users = connection.model<User>(User.name, UserSchema);
    await users.init();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminEmailChangeService,
        MONGO_ADMIN_ACCOUNT_STORE,
        { provide: getModelToken(Role.name), useValue: {} },
        { provide: getModelToken(User.name), useValue: users },
        {
          provide: VerificationCodeService,
          useValue: mockVerificationCodeService,
        },
        { provide: AuthMailService, useValue: mockAuthMailService },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    service = module.get<AdminEmailChangeService>(AdminEmailChangeService);
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    jest.clearAllMocks();
    await users.deleteMany({});
    mockVerificationCodeService.createOrUpdatePendingRegistration.mockResolvedValue(
      { code: '123456' },
    );
    mockAuthMailService.sendEmailChangeCode.mockResolvedValue(true);
  });

  async function createTarget(): Promise<UserDocument> {
    return users.create({
      email: 'old@example.com',
      name: 'Target User',
      role: 'user',
      isVerified: true,
      addressGeneration: 0,
    });
  }

  /** The account as the database holds it, whatever the test changed in memory. */
  async function storedTarget(target: UserDocument): Promise<UserDocument> {
    return users.findById(target._id).orFail().exec();
  }

  it('should refuse an actor below admin level', async () => {
    const target = await createTarget();

    await expect(
      service.apply(
        toStoredAccount(target),
        'new@example.com',
        ROLE_HIERARCHY.manager,
      ),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_CHANGE_NOT_ALLOWED });
    const stored = await storedTarget(target);
    expect(stored.email).toBe('old@example.com');
    expect(stored.isVerified).toBe(true);
  });

  it('should refuse an address already in use', async () => {
    await users.create({ email: 'new@example.com', name: 'Other' });
    const target = await createTarget();

    await expect(
      service.apply(toStoredAccount(target), 'new@example.com', ADMIN_LEVEL),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_ALREADY_EXISTS });
  });

  it('should bind the code to the user and a new generation, and mail', async () => {
    const target = await createTarget();

    const moved = await service.apply(
      toStoredAccount(target),
      'new@example.com',
      ADMIN_LEVEL,
    );

    expect(moved.email).toBe('new@example.com');
    expect(moved.isVerified).toBe(false);
    expect(moved.addressGeneration).toBe(1);
    expect(
      mockVerificationCodeService.createOrUpdatePendingRegistration,
    ).toHaveBeenCalledWith('new@example.com', PENDING_PURPOSE.EMAIL_CHANGE, {
      userId: target._id.toString(),
      addressGeneration: 1,
    });
    expect(mockAuthMailService.sendEmailChangeCode).toHaveBeenCalledWith(
      'new@example.com',
      '123456',
    );
  });

  it('should leave the account untouched when the mail fails', async () => {
    mockAuthMailService.sendEmailChangeCode.mockResolvedValueOnce(false);
    const target = await createTarget();

    await expect(
      service.apply(toStoredAccount(target), 'new@example.com', ADMIN_LEVEL),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_SEND_FAILED });
    const stored = await storedTarget(target);
    expect(stored.email).toBe('old@example.com');
    expect(stored.isVerified).toBe(true);
    expect(stored.addressGeneration).toBe(0);
  });

  it('should answer the mail cap with a distinct retryable error', async () => {
    mockVerificationCodeService.createOrUpdatePendingRegistration.mockResolvedValueOnce(
      null,
    );
    const target = await createTarget();

    await expect(
      service.apply(toStoredAccount(target), 'new@example.com', ADMIN_LEVEL),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_SEND_LIMIT_REACHED });
    expect(mockAuthMailService.sendEmailChangeCode).not.toHaveBeenCalled();
    expect((await storedTarget(target)).email).toBe('old@example.com');
  });

  it('should reissue a code for an unverified address without changing it', async () => {
    const target = await createTarget();
    target.email = 'moved@example.com';
    target.isVerified = false;
    target.addressGeneration = 3;

    await service.resend(toStoredAccount(target), ADMIN_LEVEL);

    // The re-send read the unsaved move above and stored none of it.
    const stored = await storedTarget(target);
    expect(stored.email).toBe('old@example.com');
    expect(stored.addressGeneration).toBe(0);
    expect(
      mockVerificationCodeService.createOrUpdatePendingRegistration,
    ).toHaveBeenCalledWith('moved@example.com', PENDING_PURPOSE.EMAIL_CHANGE, {
      userId: target._id.toString(),
      addressGeneration: 3,
    });
    expect(mockAuthMailService.sendEmailChangeCode).toHaveBeenCalledWith(
      'moved@example.com',
      '123456',
    );
  });

  it('should refuse to resend for a verified address', async () => {
    const target = await createTarget();

    await expect(
      service.resend(toStoredAccount(target), ADMIN_LEVEL),
    ).rejects.toMatchObject({
      code: ErrorCode.EMAIL_SEND_FAILED,
    });
    expect(
      mockVerificationCodeService.createOrUpdatePendingRegistration,
    ).not.toHaveBeenCalled();
  });

  it('should refuse to resend for an actor below admin level', async () => {
    const target = await createTarget();
    target.isVerified = false;

    await expect(
      service.resend(toStoredAccount(target), ROLE_HIERARCHY.manager),
    ).rejects.toMatchObject({ code: ErrorCode.EMAIL_CHANGE_NOT_ALLOWED });
  });
});
