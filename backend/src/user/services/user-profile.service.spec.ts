import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserProfileService } from './user-profile.service';
import { User } from '../schemas/user.schema';
import { UserRole } from '../enums/user-role.enum';
import { AuthProvider } from '../enums/auth-provider.enum';
import { Role } from '../../role/schemas/role.schema';
import { SessionService } from '../../auth/services/session.service';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

jest.mock('bcrypt');

describe('UserProfileService', () => {
  let service: UserProfileService;

  const mockUserId = new Types.ObjectId().toString();
  const mockSessionToken = 'mock-session-token';

  const mockUser = {
    _id: new Types.ObjectId(mockUserId),
    email: 'user@example.com',
    name: 'Test User',
    role: UserRole.USER,
    password: 'hashedPassword',
    isVerified: true,
    isDeleted: false,
    googleId: null,
    facebookId: null,
    save: jest.fn().mockResolvedValue(true),
  };

  const mockUserModel = {
    findById: jest.fn(),
  };

  const mockRoleModel = {
    findOne: jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ permissions: [] }),
    }),
  };

  const mockSessionService = {
    invalidateAllSessions: jest.fn().mockResolvedValue(1),
    invalidateAllSessionsExcept: jest.fn().mockResolvedValue(1),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserProfileService,
        { provide: getModelToken(User.name), useValue: mockUserModel },
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<UserProfileService>(UserProfileService);

    jest.clearAllMocks();
    mockRoleModel.findOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ permissions: [] }),
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getProfile', () => {
    beforeEach(() => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockUser),
      });
    });

    it('should return user profile', async () => {
      const result = await service.getProfile(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data?.email).toBe('user@example.com');
      expect(result.data?.name).toBe('Test User');
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.getProfile(mockUserId)).rejects.toThrow(
        AppException,
      );
    });

    it('should reject a malformed user id', async () => {
      await expect(service.getProfile('not-an-id')).rejects.toMatchObject({
        code: ErrorCode.INVALID_INPUT,
      });
    });
  });

  describe('updateProfile', () => {
    beforeEach(() => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({ ...mockUser }),
      });
    });

    it('should update user name', async () => {
      const userToUpdate = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userToUpdate),
      });

      const result = await service.updateProfile(mockUserId, {
        name: 'New Name',
      });

      expect(result.success).toBe(true);
      expect(userToUpdate.save).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(
        service.updateProfile(mockUserId, { name: 'New Name' }),
      ).rejects.toThrow(AppException);
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({
          ...mockUser,
          save: jest.fn().mockResolvedValue(true),
        }),
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('newHashedPassword');
    });

    it('should change password successfully', async () => {
      const userToUpdate = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(userToUpdate),
      });
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(false); // new password is different

      const result = await service.changePassword(
        mockUserId,
        { currentPassword: 'oldPassword', newPassword: 'NewPassword123' },
        mockSessionToken,
      );

      expect(result.success).toBe(true);
      expect(userToUpdate.save).toHaveBeenCalled();
      expect(mockSessionService.invalidateAllSessionsExcept).toHaveBeenCalled();
    });

    it('should throw error if current password is incorrect', async () => {
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.changePassword(
          mockUserId,
          { currentPassword: 'wrongPassword', newPassword: 'NewPassword123' },
          mockSessionToken,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_CURRENT_PASSWORD });
    });

    it('should throw error if new password is same as current', async () => {
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(true); // new password is same

      await expect(
        service.changePassword(
          mockUserId,
          { currentPassword: 'oldPassword', newPassword: 'oldPassword' },
          mockSessionToken,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.SAME_PASSWORD });
    });

    it('should refuse an account without a password', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue({ ...mockUser, password: undefined }),
      });

      await expect(
        service.changePassword(
          mockUserId,
          { currentPassword: 'oldPassword', newPassword: 'NewPassword123' },
          mockSessionToken,
        ),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_CURRENT_PASSWORD });
    });
  });

  describe('deactivateAccount', () => {
    it('should deactivate account', async () => {
      const userToDeactivate = {
        ...mockUser,
        save: jest.fn().mockResolvedValue(true),
      };
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(userToDeactivate),
      });

      const result = await service.deactivateAccount(mockUserId);

      expect(result.success).toBe(true);
      expect(userToDeactivate.save).toHaveBeenCalled();
      expect(mockSessionService.invalidateAllSessions).toHaveBeenCalled();
    });

    it('should throw error if user not found', async () => {
      mockUserModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.deactivateAccount(mockUserId)).rejects.toThrow(
        AppException,
      );
    });
  });

  describe('getPrimaryProvider', () => {
    it('should return the stored provider', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest
          .fn()
          .mockResolvedValue({ primaryProvider: AuthProvider.GOOGLE }),
      });

      expect(await service.getPrimaryProvider(mockUserId)).toBe(
        AuthProvider.GOOGLE,
      );
    });

    it('should return undefined when the user is gone', async () => {
      mockUserModel.findById.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(null),
      });

      expect(await service.getPrimaryProvider(mockUserId)).toBeUndefined();
    });
  });
});
