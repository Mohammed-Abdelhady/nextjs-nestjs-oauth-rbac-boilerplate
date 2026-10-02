import { Injectable, Logger } from '@nestjs/common';
import { Types } from 'mongoose';
import { LeanSession } from '../../session/schemas/session.schema';
import { SessionIssuanceService } from '../../session/services/session-issuance.service';
import { SessionAuthorityService } from '../../session/services/session-authority.service';
import { SessionRevocationService } from '../../session/services/session-revocation.service';
import { hashToken } from '../../session/utils/token-hash';

export { hashToken };

@Injectable()
export class SessionService {
  private readonly logger = new Logger(SessionService.name);

  constructor(
    private readonly issuance: SessionIssuanceService,
    private readonly authority: SessionAuthorityService,
    private readonly revocation: SessionRevocationService,
  ) {}

  async createSession(
    userId: Types.ObjectId,
    userAgent: string,
    ip: string,
  ): Promise<string> {
    const token = await this.issuance.createBrowserSession(
      userId,
      userAgent,
      ip,
    );
    this.logger.log(`Session created for user ${userId.toString()}`);
    return token;
  }

  async validateSession(token: string): Promise<LeanSession | null> {
    return this.authority.validate(token, { extendIdle: true });
  }

  async invalidateSession(token: string): Promise<boolean> {
    const revoked = await this.revocation.revokeByToken(token);
    this.logger.log(`Session invalidated: ${revoked ? 1 : 0} document(s)`);
    return revoked;
  }

  async invalidateAllSessions(userId: Types.ObjectId): Promise<number> {
    const count = await this.revocation.revokeAllForUser(userId);
    this.logger.log(
      `All sessions invalidated for user ${userId.toString()}: ${count} document(s)`,
    );
    return count;
  }

  async getUserSessions(userId: Types.ObjectId): Promise<LeanSession[]> {
    return this.authority.listActive(userId);
  }

  async getSessionById(sessionId: string): Promise<LeanSession | null> {
    return this.authority.getById(sessionId);
  }

  async invalidateSessionById(
    sessionId: string,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    const revoked = await this.revocation.revokeById(sessionId, userId);
    if (revoked) {
      this.logger.log(
        `Session ${sessionId} invalidated for user ${userId.toString()}`,
      );
    }
    return revoked;
  }

  async invalidateAllSessionsExcept(
    userId: Types.ObjectId,
    exceptToken: string,
  ): Promise<number> {
    const count = await this.revocation.revokeAllOthers(userId, exceptToken);
    this.logger.log(
      `All sessions except current invalidated for user ${userId.toString()}: ${count} document(s)`,
    );
    return count;
  }

  async getSessionByToken(token: string): Promise<LeanSession | null> {
    return this.authority.getByToken(token);
  }
}
