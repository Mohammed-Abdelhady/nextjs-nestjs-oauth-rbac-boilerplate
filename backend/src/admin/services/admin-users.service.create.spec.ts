import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { AdminUsersService } from './admin-users.service';
import { AdminUserAccessService } from './admin-user-access.service';
import { AdminEmailChangeService } from './admin-email-change.service';
import { SessionService } from '../../auth/services/session.service';
import { User } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';
import { ErrorCode } from '../../common/enums/error-code.enum';

interface CreatedDoc extends Record<string, unknown> {
  _id: Types.ObjectId;
  save: jest.Mock;
}

describe('AdminUsersService.createUser (D-12)', () => {
  let service: AdminUsersService;
  let created: CreatedDoc[];
  let findOne: jest.Mock;

  const createUserDto = {
    email: 'new@example.com',
    name: 'New User',
    password: 'SecureP@ssw0rd',
    role: 'user',
  };

  const mockAccessService = {
    assertCanAssignRole: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    created = [];
    findOne = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });

    const userModel = Object.assign(
      jest.fn((doc: Record<string, unknown>) => {
        const instance: CreatedDoc = {
          ...doc,
          _id: new Types.ObjectId(),
          permissions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          save: jest.fn().mockResolvedValue(undefined),
        };
        created.push(instance);
        return instance;
      }),
      { findOne },
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        { provide: getModelToken(User.name), useValue: userModel },
        {
          provide: SessionService,
          useValue: { invalidateAllSessions: jest.fn() },
        },
        { provide: AdminUserAccessService, useValue: mockAccessService },
        { provide: AdminEmailChangeService, useValue: { apply: jest.fn() } },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    jest.clearAllMocks();
    mockAccessService.assertCanAssignRole.mockResolvedValue(undefined);
  });

  it('should record email as the provider the account was created with', async () => {
    await service.createUser(createUserDto, 'admin');

    expect(created).toHaveLength(1);
    expect(created[0].authProvider).toBe(AuthProvider.EMAIL);
    expect(created[0].primaryProvider).toBe(AuthProvider.EMAIL);
    expect(created[0].save).toHaveBeenCalled();
  });

  it('should hash the password instead of storing it', async () => {
    await service.createUser(createUserDto, 'admin');

    expect(created[0].password).not.toBe(createUserDto.password);
    expect(String(created[0].password)).toMatch(/^\$2[aby]\$/);
  });

  it('should refuse an address that is already in use', async () => {
    findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ email: 'new@example.com' }),
    });

    await expect(
      service.createUser(createUserDto, 'admin'),
    ).rejects.toMatchObject({
      code: ErrorCode.EMAIL_ALREADY_EXISTS,
      status: 409,
    });
    expect(created).toHaveLength(0);
  });
});
