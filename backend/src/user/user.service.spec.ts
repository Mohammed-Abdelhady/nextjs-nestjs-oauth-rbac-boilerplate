import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { UserService } from './user.service';
import { User } from './schemas/user.schema';
import { UserRole } from './enums/user-role.enum';
import { Role } from '../role/schemas/role.schema';
import { SessionService } from '../auth/services/session.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/enums/error-code.enum';

jest.mock('bcrypt');

describe('UserService', () => {
  let service: UserService;

  const mockUserId = new Types.ObjectId().toString();
  const mockSessionToken = 'mock-session-token';
  const mockSessionId = new Types.ObjectId().toString();

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

  const mockSession = {
    _id: new Types.ObjectId(mockSessionId),
    user: new Types.ObjectId(mockUserId),
    tokenHash: mockSessionToken,
    userAgent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    deviceName: 'Chrome',
    isValid: true,
    lastUsedAt: new Date(),
    createdAt: new Date(),
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
    getUserSessions: jest.fn().mockResolvedValue([mockSession]),
    getSessionByToken: jest.fn().mockResolvedValue(mockSession),
    getSessionById: jest.fn().mockResolvedValue(mockSession),
    invalidateAllSessions: jest.fn().mockResolvedValue(1),
    invalidateAllSessionsExcept: jest.fn().mockResolvedValue(1),
    invalidateSessionById: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: getModelToken(Role.name),
          useValue: mockRoleModel,
        },
        {
          provide: SessionService,
          useValue: mockSessionService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);

    jest.clearAllMocks();
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

      try {
        await service.changePassword(
          mockUserId,
          { currentPassword: 'wrongPassword', newPassword: 'NewPassword123' },
          mockSessionToken,
        );
        fail('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ErrorCode.INVALID_CURRENT_PASSWORD,
        );
      }
    });

    it('should throw error if new password is same as current', async () => {
      (bcrypt.compare as jest.Mock)
        .mockResolvedValueOnce(true) // current password valid
        .mockResolvedValueOnce(true); // new password is same

      try {
        await service.changePassword(
          mockUserId,
          { currentPassword: 'oldPassword', newPassword: 'oldPassword' },
          mockSessionToken,
        );
        fail('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(ErrorCode.SAME_PASSWORD);
      }
    });
  });

  describe('getSessions', () => {
    it('should return all active sessions', async () => {
      const result = await service.getSessions(mockUserId, mockSessionToken);

      expect(result.success).toBe(true);
      expect(result.data?.sessions).toHaveLength(1);
      expect(result.data?.sessions[0].isCurrent).toBe(true);
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session', async () => {
      const differentSessionId = new Types.ObjectId().toString();
      mockSessionService.getSessionByToken.mockResolvedValue({
        ...mockSession,
        _id: new Types.ObjectId(),
      });

      const result = await service.revokeSession(
        mockUserId,
        differentSessionId,
        mockSessionToken,
      );

      expect(result.success).toBe(true);
      expect(mockSessionService.invalidateSessionById).toHaveBeenCalled();
    });

    it('should throw error when revoking current session', async () => {
      // Ensure getSessionByToken returns a session with the same ID we're trying to revoke
      mockSessionService.getSessionByToken.mockResolvedValue(mockSession);

      try {
        await service.revokeSession(
          mockUserId,
          mockSessionId,
          mockSessionToken,
        );
        fail('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(
          ErrorCode.CANNOT_REVOKE_CURRENT_SESSION,
        );
      }
    });

    it('should throw error when session not found', async () => {
      const differentSessionId = new Types.ObjectId().toString();
      mockSessionService.getSessionByToken.mockResolvedValue({
        ...mockSession,
        _id: new Types.ObjectId(),
      });
      mockSessionService.invalidateSessionById.mockResolvedValue(false);

      try {
        await service.revokeSession(
          mockUserId,
          differentSessionId,
          mockSessionToken,
        );
        fail('Expected AppException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(AppException);
        expect((error as AppException).code).toBe(ErrorCode.SESSION_NOT_FOUND);
      }
    });
  });

  describe('revokeAllOtherSessions', () => {
    it('should revoke all other sessions', async () => {
      mockSessionService.invalidateAllSessionsExcept.mockResolvedValue(3);

      const result = await service.revokeAllOtherSessions(
        mockUserId,
        mockSessionToken,
      );

      expect(result.success).toBe(true);
      expect(result.data?.revokedCount).toBe(3);
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
});
