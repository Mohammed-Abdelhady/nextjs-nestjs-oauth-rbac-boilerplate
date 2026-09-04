import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { Types } from 'mongoose';
import { SessionService } from '../../auth/services/session.service';
import { SessionDto, SessionListData } from '../dto/user-profile.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { assertValidObjectId } from '../utils/user-lookup.util';

/**
 * Self-service session management: listing a user's own sessions and
 * revoking them.
 */
@Injectable()
export class UserSessionsService {
  private readonly logger = new Logger(UserSessionsService.name);

  constructor(private readonly sessionService: SessionService) {}

  /**
   * Get all active sessions for current user.
   */
  async getSessions(
    userId: string,
    currentSessionToken: string,
  ): Promise<ApiResponse<SessionListData>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const sessions = await this.sessionService.getUserSessions(
      new Types.ObjectId(userId),
    );

    // Get current session to mark it
    const currentSession =
      await this.sessionService.getSessionByToken(currentSessionToken);
    const currentSessionId = currentSession?._id?.toString();

    const sessionDtos: SessionDto[] = sessions.map((session) => ({
      id: session._id.toString(),
      userAgent: session.userAgent,
      ip: session.ip,
      deviceName: session.deviceName,
      createdAt: session.createdAt,
      lastUsedAt: session.lastUsedAt,
      isCurrent: session._id.toString() === currentSessionId,
    }));

    this.logger.log(
      `Retrieved ${sessions.length} sessions for user: ${userId}`,
    );
    return ApiResponse.success({
      sessions: sessionDtos,
      total: sessionDtos.length,
    });
  }

  /**
   * Revoke a specific session.
   */
  async revokeSession(
    userId: string,
    sessionId: string,
    currentSessionToken: string,
  ): Promise<ApiResponse<{ message: string }>> {
    assertValidObjectId(userId, 'Invalid user ID format');
    assertValidObjectId(sessionId, 'Invalid session ID format');

    // Check if trying to revoke current session
    const currentSession =
      await this.sessionService.getSessionByToken(currentSessionToken);

    if (currentSession && currentSession._id.toString() === sessionId) {
      throw new AppException(
        ErrorCode.CANNOT_REVOKE_CURRENT_SESSION,
        'Cannot revoke current session. Use logout instead.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const revoked = await this.sessionService.invalidateSessionById(
      sessionId,
      new Types.ObjectId(userId),
    );

    if (!revoked) {
      throw new AppException(
        ErrorCode.SESSION_NOT_FOUND,
        'Session not found or already revoked',
        HttpStatus.NOT_FOUND,
      );
    }

    this.logger.log(`Session ${sessionId} revoked for user: ${userId}`);
    return ApiResponse.success({ message: 'Session revoked successfully' });
  }

  /**
   * Revoke all sessions except current.
   */
  async revokeAllOtherSessions(
    userId: string,
    currentSessionToken: string,
  ): Promise<ApiResponse<{ revokedCount: number }>> {
    assertValidObjectId(userId, 'Invalid user ID format');

    const revokedCount = await this.sessionService.invalidateAllSessionsExcept(
      new Types.ObjectId(userId),
      currentSessionToken,
    );

    this.logger.log(`Revoked ${revokedCount} sessions for user: ${userId}`);
    return ApiResponse.success({
      revokedCount,
    });
  }
}
