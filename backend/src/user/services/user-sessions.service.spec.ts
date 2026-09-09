import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { UserSessionsService } from './user-sessions.service';
import { SessionService } from '../../auth/services/session.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('UserSessionsService', () => {
  let service: UserSessionsService;

  const mockUserId = new Types.ObjectId().toString();
  const mockSessionId = new Types.ObjectId().toString();
  const mockSessionToken = 'mock-session-token';

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

  const mockSessionService = {
    getUserSessions: jest.fn().mockResolvedValue([mockSession]),
    getSessionByToken: jest.fn().mockResolvedValue(mockSession),
    invalidateAllSessionsExcept: jest.fn().mockResolvedValue(1),
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
    mockSessionService.getSessionByToken.mockResolvedValue(mockSession);
    mockSessionService.invalidateSessionById.mockResolvedValue(true);
  });

  describe('getSessions', () => {
    it('should return all active sessions', async () => {
      const result = await service.getSessions(mockUserId, mockSessionToken);

      expect(result.success).toBe(true);
      expect(result.data?.sessions).toHaveLength(1);
      expect(result.data?.sessions[0].isCurrent).toBe(true);
    });

    it('should reject a malformed user id', async () => {
      await expect(
        service.getSessions('not-an-id', mockSessionToken),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_INPUT });
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
      mockSessionService.getSessionByToken.mockResolvedValue(mockSession);

      await expect(
        service.revokeSession(mockUserId, mockSessionId, mockSessionToken),
      ).rejects.toMatchObject({
        code: ErrorCode.CANNOT_REVOKE_CURRENT_SESSION,
      });
    });

    it('should throw error when session not found', async () => {
      const differentSessionId = new Types.ObjectId().toString();
      mockSessionService.getSessionByToken.mockResolvedValue({
        ...mockSession,
        _id: new Types.ObjectId(),
      });
      mockSessionService.invalidateSessionById.mockResolvedValue(false);

      await expect(
        service.revokeSession(mockUserId, differentSessionId, mockSessionToken),
      ).rejects.toMatchObject({ code: ErrorCode.SESSION_NOT_FOUND });
    });

    it('should reject a malformed session id', async () => {
      await expect(
        service.revokeSession(mockUserId, 'not-an-id', mockSessionToken),
      ).rejects.toMatchObject({ code: ErrorCode.INVALID_INPUT });
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
});
