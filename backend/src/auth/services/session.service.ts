import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { Session, SessionDocument } from '../../session/schemas/session.schema';
import { UserDocument } from '../../user/schemas/user.schema';
import { Types } from 'mongoose';

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new session for a user
   * @param userId - The user's ObjectId
   * @param userAgent - The user's browser/user agent
   * @param ip - The user's IP address
   * @returns The generated session token
   */
  async createSession(
    userId: Types.ObjectId,
    userAgent: string,
    ip: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const cookieMaxAge = this.configService.get<number>(
      'session.cookieMaxAge',
      604800000,
    );

    const expiresAt = new Date(Date.now() + cookieMaxAge);

    await this.sessionModel.create({
      user: userId,
      refreshToken: token,
      userAgent,
      ip,
      expiresAt,
    });

    this.logger.log(`Session created for user ${userId.toString()}`);

    return token;
  }

  /**
   * Validate a session token
   * @param token - The session token to validate
   * @returns The session document if valid, null otherwise
   */
  async validateSession(token: string): Promise<SessionDocument | null> {
    const session = await this.sessionModel
      .findOne({
        refreshToken: token,
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .populate('user');

    if (!session) {
      return null;
    }

    const user = session.user as unknown as UserDocument | null;
    if (!user || user.isDeleted) {
      return null;
    }

    // Update last used timestamp
    session.lastUsedAt = new Date();
    await session.save();

    return session;
  }

  /**
   * Invalidate a session (logout)
   * @param token - The session token to invalidate
   * @returns true if session was invalidated, false otherwise
   */
  async invalidateSession(token: string): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      { refreshToken: token },
      { isValid: false },
    );

    this.logger.log(`Session invalidated: ${result.modifiedCount} document(s)`);

    return result.modifiedCount > 0;
  }

  /**
   * Invalidate all sessions for a user
   * @param userId - The user's ObjectId
   * @returns The number of sessions invalidated
   */
  async invalidateAllSessions(userId: Types.ObjectId): Promise<number> {
    const result = await this.sessionModel.updateMany(
      { user: userId },
      { isValid: false },
    );

    this.logger.log(
      `All sessions invalidated for user ${userId.toString()}: ${result.modifiedCount} document(s)`,
    );

    return result.modifiedCount;
  }

  /**
   * Get all active sessions for a user
   * @param userId - The user's ObjectId
   * @returns Array of session documents
   */
  async getUserSessions(userId: Types.ObjectId): Promise<SessionDocument[]> {
    return this.sessionModel
      .find({
        user: userId,
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastUsedAt: -1 })
      .exec();
  }

  /**
   * Get a session by ID
   * @param sessionId - The session's ObjectId
   * @returns The session document or null
   */
  async getSessionById(sessionId: string): Promise<SessionDocument | null> {
    return this.sessionModel.findById(sessionId).exec();
  }

  /**
   * Invalidate a specific session by ID
   * @param sessionId - The session's ObjectId
   * @param userId - The user's ObjectId (for ownership verification)
   * @returns true if session was invalidated, false otherwise
   */
  async invalidateSessionById(
    sessionId: string,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    const result = await this.sessionModel.updateOne(
      { _id: sessionId, user: userId, isValid: true },
      { isValid: false },
    );

    if (result.modifiedCount > 0) {
      this.logger.log(
        `Session ${sessionId} invalidated for user ${userId.toString()}`,
      );
      return true;
    }

    return false;
  }

  /**
   * Invalidate all sessions for a user except one
   * @param userId - The user's ObjectId
   * @param exceptToken - The token to keep valid (current session)
   * @returns The number of sessions invalidated
   */
  async invalidateAllSessionsExcept(
    userId: Types.ObjectId,
    exceptToken: string,
  ): Promise<number> {
    const result = await this.sessionModel.updateMany(
      { user: userId, refreshToken: { $ne: exceptToken }, isValid: true },
      { isValid: false },
    );

    this.logger.log(
      `All sessions except current invalidated for user ${userId.toString()}: ${result.modifiedCount} document(s)`,
    );

    return result.modifiedCount;
  }

  /**
   * Get session ID from token
   * @param token - The session token
   * @returns The session document or null
   */
  async getSessionByToken(token: string): Promise<SessionDocument | null> {
    return this.sessionModel.findOne({ refreshToken: token }).exec();
  }
}
