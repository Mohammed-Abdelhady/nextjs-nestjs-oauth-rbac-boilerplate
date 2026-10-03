import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UserSessionsService } from './user-sessions.service';
import { SessionService } from '../../auth/services/session.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('UserSessionsService', () => {
  let service: UserSessionsService;

  const mockUserId = new Types.ObjectId().toString();
  const mockSessionId = new Types.ObjectId().toString();
  const otherSessionId = new Types.ObjectId().toString();

  const mockSession = {
    _id: new Types.ObjectId(mockSessionId),
    user: new Types.ObjectId(mockUserId),
    userAgent: 'Mozilla/5.0',
    ip: '127.0.0.1',
    deviceName: 'Chrome',
    isValid: true,
    lastUsedAt: new Date(),
    createdAt: new Date(),
    credentialPurpose: 'browser_session',
  };

  const mockSessionService = {
    getUserSessions: jest.fn().mockResolvedValue([mockSession]),
    invalidateAllSessionsExceptSession: jest.fn().mockResolvedValue(1),
    invalidateSessionById: jest.fn().mockResolvedValue(true),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserSessionsService,
        { provide: SessionService, useValue: mockSessionService },
      ],
    }).compile();

    service = module.get<UserSessionsService>(UserSessionsService);

    jest.clearAllMocks();
    mockSessionService.getUserSessions.mockResolvedValue([mockSession]);
    mockSessionService.invalidateSessionById.mockResolvedValue(true);
  });

  describe('getSessions', () => {
    it('should return all active sessions', async () => {
      const result = await service.getSessions(mockUserId, mockSessionId);

      expect(result.success).toBe(true);
      expect(result.data?.sessions).toHaveLength(1);
      expect(result.data?.sessions[0].isCurrent).toBe(true);
      expect(result.data?.sessions[0].credentialPurpose).toBe(
        'browser_session',
      );
    });

    it('should mark no session current for a caller without a session', async () => {
      const result = await service.getSessions(mockUserId, null);

      expect(result.success).toBe(true);
      expect(result.data?.sessions).toHaveLength(1);
      expect(result.data?.sessions[0].isCurrent).toBe(false);
    });

    it('should reject a malformed user id', async () => {
      await expect(
        service.getSessions('not-an-id', mockSessionId),
      ).rejects.toMatchObject({
        code: ErrorCode.INVALID_INPUT,
      });
    });
  });

  describe('revokeSession', () => {
    it('should revoke a session', async () => {
      const result = await service.revokeSession(
        mockUserId,
        otherSessionId,
        mockSessionId,
      );

      expect(result.success).toBe(true);
      expect(mockSessionService.invalidateSessionById).toHaveBeenCalled();
    });

    it('should throw error when revoking current session', async () => {
      await expect(
        service.revokeSession(mockUserId, mockSessionId, mockSessionId),
      ).rejects.toMatchObject({
        code: ErrorCode.CANNOT_REVOKE_CURRENT_SESSION,
      });
    });

    it('should throw error when session not found', async () => {
      mockSessionService.invalidateSessionById.mockResolvedValue(false);

      await expect(
        service.revokeSession(mockUserId, otherSessionId, mockSessionId),
      ).rejects.toMatchObject({ code: ErrorCode.SESSION_NOT_FOUND });
    });

    it('should reject a malformed session id', async () => {
      await expect(
        service.revokeSession(mockUserId, 'not-an-id', mockSessionId),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_INPUT });
    });
  });

  describe('revokeAllOtherSessions', () => {
    it('should revoke all other sessions', async () => {
      mockSessionService.invalidateAllSessionsExceptSession.mockResolvedValue(
        3,
      );

      const result = await service.revokeAllOtherSessions(
        mockUserId,
        mockSessionId,
      );

      expect(result.success).toBe(true);
      expect(result.data?.revokedCount).toBe(3);
      expect(
        mockSessionService.invalidateAllSessionsExceptSession,
      ).toHaveBeenCalledWith(expect.anything(), mockSessionId);
    });

    it('should refuse without a current session', async () => {
      await expect(
        service.revokeAllOtherSessions(mockUserId, null),
      ).rejects.toMatchObject({ code: ErrorCode.SESSION_INVALID });
    });
  });
});
