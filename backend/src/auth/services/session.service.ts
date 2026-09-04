import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import {
  Session,
  SessionDocument,
  LeanSession,
} from '../../session/schemas/session.schema';
import { UserDocument } from '../../user/schemas/user.schema';
import { SESSION_LAST_USED_UPDATE_INTERVAL_MS } from '../../common/constants/session';
import { parseUserAgent } from '../../common/utils/parse-user-agent';

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Create a new session for a user.
   * Stores sha256 token hash in database and returns raw token once.
   */
  async createSession(
    userId: Types.ObjectId,
    userAgent: string,
    ip: string,
  ): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const tokenHash = hashToken(token);
    const cookieMaxAge = this.configService.get<number>(
      'session.cookieMaxAge',
      604800000,
    );

    const expiresAt = new Date(Date.now() + cookieMaxAge);
    const device = parseUserAgent(userAgent);

    await this.sessionModel.create({
      user: userId,
      tokenHash,
      userAgent,
      device,
      deviceName: device.name,
      ip,
      expiresAt,
    });

    this.logger.log(`Session created for user ${userId.toString()}`);

    return token;
  }

  /**
   * Validate a session token.
   * Hashes the incoming token before lookup.
   * Updates lastUsedAt with updateOne only when older than 5 minutes.
   */
  async validateSession(token: string): Promise<LeanSession | null> {
    const tokenHash = hashToken(token);
    const session = await this.sessionModel
      .findOne({
        tokenHash,
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .populate('user')
      .lean<LeanSession | null>()
      .exec();

    if (!session) {
      return null;
    }

    const user = session.user as unknown as UserDocument | null;
    if (!user || user.isDeleted) {
      return null;
    }

    const now = new Date();
    const lastUsedTime = session.lastUsedAt
      ? new Date(session.lastUsedAt).getTime()
      : 0;

    if (now.getTime() - lastUsedTime > SESSION_LAST_USED_UPDATE_INTERVAL_MS) {
      await this.sessionModel.updateOne(
        { _id: session._id },
        { $set: { lastUsedAt: now } },
      );
      session.lastUsedAt = now;
    }

    return session;
  }

  /**
   * Invalidate a session by token.
   */
  async invalidateSession(token: string): Promise<boolean> {
    const tokenHash = hashToken(token);
    const result = await this.sessionModel.updateOne(
      { tokenHash },
      { isValid: false },
    );

    this.logger.log(`Session invalidated: ${result.modifiedCount} document(s)`);

    return result.modifiedCount > 0;
  }

  /**
   * Invalidate all sessions for a user.
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
   * Get all active sessions for a user.
   */
  async getUserSessions(userId: Types.ObjectId): Promise<LeanSession[]> {
    return this.sessionModel
      .find({
        user: userId,
        isValid: true,
        expiresAt: { $gt: new Date() },
      })
      .sort({ lastUsedAt: -1 })
      .lean<LeanSession[]>()
      .exec();
  }

  /**
   * Get a session by ID.
   */
  async getSessionById(sessionId: string): Promise<LeanSession | null> {
    return this.sessionModel
      .findById(sessionId)
      .lean<LeanSession | null>()
      .exec();
  }

  /**
   * Invalidate a specific session by ID.
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
   * Invalidate all sessions for a user except one.
   */
  async invalidateAllSessionsExcept(
    userId: Types.ObjectId,
    exceptToken: string,
  ): Promise<number> {
    const exceptTokenHash = hashToken(exceptToken);
    const result = await this.sessionModel.updateMany(
      { user: userId, tokenHash: { $ne: exceptTokenHash }, isValid: true },
      { isValid: false },
    );

    this.logger.log(
      `All sessions except current invalidated for user ${userId.toString()}: ${result.modifiedCount} document(s)`,
    );

    return result.modifiedCount;
  }

  /**
   * Get session by raw token.
   */
  async getSessionByToken(token: string): Promise<LeanSession | null> {
    const tokenHash = hashToken(token);
    return this.sessionModel
      .findOne({ tokenHash })
      .lean<LeanSession | null>()
      .exec();
  }
}
