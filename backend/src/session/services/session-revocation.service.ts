import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { Clock } from '../../common/services/clock';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { REVOKED_REASON } from '../constants/revoked-reason';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import { Session, SessionDocument } from '../schemas/session.schema';
import { asAuthorityUnavailable } from '../utils/authority-unavailable';
import { withMajorityTransaction } from '../utils/mongo-transaction';
import { hashToken } from '../utils/token-hash';
import { SecurityEventService } from './security-event.service';
import { RoleAssignmentEvent } from '../types/role-assignment-event';

/**
 * Who forced a session revocation and why, carried onto the security event so
 * an admin-forced sign-out is not mistaken for the user's own.
 */
export interface RevocationContext {
  actorId?: string;
  reasonCode?: string;
  roleAssignment?: RoleAssignmentEvent;
}

@Injectable()
export class SessionRevocationService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly events: SecurityEventService,
    private readonly clock: Clock,
  ) {}

  async revokeByToken(token: string): Promise<boolean> {
    return this.run((session) =>
      this.revokeMatched(
        session,
        {
          tokenHash: hashToken(token),
          isValid: true,
          revokedAt: { $exists: false },
        },
        REVOKED_REASON.CURRENT,
        SECURITY_EVENT_ACTION.SESSION_REVOKED,
      ),
    ).then((count) => count > 0);
  }

  async revokeById(
    sessionId: string,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    return this.run((session) =>
      this.revokeMatched(
        session,
        {
          _id: sessionId,
          user: userId,
          isValid: true,
          revokedAt: { $exists: false },
        },
        REVOKED_REASON.SELECTED,
        SECURITY_EVENT_ACTION.SESSION_REVOKED,
      ),
    ).then((count) => count > 0);
  }

  async revokeAllForUser(
    userId: Types.ObjectId,
    db?: ClientSession,
    context?: RevocationContext,
  ): Promise<number> {
    if (db) {
      return this.revokeAllForUserIn(db, userId, context);
    }
    return this.run((session) =>
      this.revokeAllForUserIn(session, userId, context),
    );
  }

  private async revokeAllForUserIn(
    session: ClientSession,
    userId: Types.ObjectId,
    context?: RevocationContext,
  ): Promise<number> {
    const user = await this.userModel.findById(userId).session(session).exec();
    if (!user) {
      return 0;
    }
    const count = await this.countActive(
      session,
      userId,
      user.sessionVersion ?? 0,
    );
    await this.userModel
      .updateOne({ _id: userId }, { $inc: { sessionVersion: 1 } })
      .session(session)
      .exec();
    await this.events.record(
      {
        actorId: context?.actorId,
        targetUserId: userId.toString(),
        action: SECURITY_EVENT_ACTION.SESSIONS_REVOKED_ALL,
        reasonCode: context?.reasonCode ?? REVOKED_REASON.ALL_USER,
        roleAssignment: context?.roleAssignment,
      },
      session,
    );
    return count;
  }

  async revokeAllOthersExceptSession(
    userId: Types.ObjectId,
    exceptSessionId: string,
    db?: ClientSession,
  ): Promise<number> {
    if (db) {
      return this.revokeOthersExceptSessionIn(db, userId, exceptSessionId);
    }
    return this.run((session) =>
      this.revokeOthersExceptSessionIn(session, userId, exceptSessionId),
    );
  }

  private async revokeOthersExceptSessionIn(
    session: ClientSession,
    userId: Types.ObjectId,
    exceptSessionId: string,
  ): Promise<number> {
    const user = await this.userModel.findById(userId).session(session).exec();
    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!Types.ObjectId.isValid(exceptSessionId)) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Current session is no longer active',
        HttpStatus.UNAUTHORIZED,
      );
    }
    const survivor = await this.sessionModel
      .findOne({ _id: exceptSessionId, user: userId })
      .session(session)
      .exec();
    return this.revokeOthersKeeping(session, user, survivor);
  }

  private async revokeOthersKeeping(
    session: ClientSession,
    user: UserDocument,
    survivor: SessionDocument | null,
  ): Promise<number> {
    const userId = user._id;
    const currentVersion = user.sessionVersion ?? 0;
    if (
      !survivor ||
      !survivor.isValid ||
      survivor.revokedAt ||
      (survivor.userVersion ?? -1) !== currentVersion
    ) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Current session is no longer active',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const count = await this.countActive(session, userId, currentVersion);
    const nextVersion = currentVersion + 1;
    const bumped = await this.userModel
      .updateOne(
        { _id: userId, sessionVersion: currentVersion },
        { $inc: { sessionVersion: 1 } },
      )
      .session(session)
      .exec();
    if (bumped.modifiedCount !== 1) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Current session is no longer active',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const promoted = await this.sessionModel
      .updateOne(
        {
          _id: survivor._id,
          isValid: true,
          revokedAt: { $exists: false },
          userVersion: currentVersion,
        },
        { $set: { userVersion: nextVersion } },
      )
      .session(session)
      .exec();
    if (promoted.modifiedCount !== 1) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Current session is no longer active',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.events.record(
      {
        targetUserId: userId.toString(),
        sessionId: survivor._id.toString(),
        action: SECURITY_EVENT_ACTION.SESSIONS_REVOKED_OTHERS,
        reasonCode: REVOKED_REASON.ALL_OTHER,
      },
      session,
    );
    return Math.max(0, count - 1);
  }

  private async run(
    work: (session: ClientSession) => Promise<number>,
  ): Promise<number> {
    try {
      return await withMajorityTransaction(this.connection, work);
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  private async revokeMatched(
    session: ClientSession,
    filter: Record<string, unknown>,
    reason: string,
    action: string,
  ): Promise<number> {
    const now = this.clock.now();
    const existing = await this.sessionModel
      .findOne(filter)
      .session(session)
      .exec();
    if (!existing) {
      return 0;
    }
    const result = await this.sessionModel
      .updateOne(filter, {
        $set: {
          isValid: false,
          revokedAt: now,
          revokedReason: reason,
        },
      })
      .session(session)
      .exec();
    if (result.modifiedCount > 0) {
      await this.events.record(
        {
          targetUserId: existing.user.toString(),
          clientId: existing.clientId,
          sessionId: existing._id.toString(),
          action,
          reasonCode: reason,
        },
        session,
      );
    }
    return result.modifiedCount;
  }

  private countActive(
    session: ClientSession,
    userId: Types.ObjectId,
    userVersion: number,
  ): Promise<number> {
    const now = this.clock.now();
    return this.sessionModel
      .countDocuments({
        user: userId,
        isValid: true,
        revokedAt: { $exists: false },
        expiresAt: { $gt: now },
        idleExpiresAt: { $gt: now },
        userVersion,
      })
      .session(session)
      .exec();
  }
}
