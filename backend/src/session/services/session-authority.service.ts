import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SESSION_LAST_USED_UPDATE_INTERVAL_MS } from '../../common/constants/session';
import { Clock } from '../../common/services/clock';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import { AUTH_SCHEMA_VERSION } from '../constants/session-policy';
import {
  LeanSession,
  Session,
  SessionDocument,
} from '../schemas/session.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../schemas/user-application-grant.schema';
import { asAuthorityUnavailable } from '../utils/authority-unavailable';
import { linearizable } from '../utils/linearizable-query';
import {
  addMs,
  capIdleByAbsolute,
  effectiveDeadline,
  isDeadlinePassed,
} from '../utils/session-deadline';
import { hashToken } from '../utils/token-hash';
import { ApplicationRegistryService } from './application-registry.service';

export interface ValidateSessionOptions {
  extendIdle?: boolean;
}

@Injectable()
export class SessionAuthorityService {
  constructor(
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grantModel: Model<UserApplicationGrantDocument>,
    private readonly applications: ApplicationRegistryService,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async validate(
    token: string,
    options: ValidateSessionOptions = {},
  ): Promise<LeanSession | null> {
    const extendIdle = options.extendIdle !== false;
    try {
      return await this.validateAuthoritative(token, extendIdle);
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async listActive(userId: Types.ObjectId): Promise<LeanSession[]> {
    try {
      const now = this.clock.now();
      const user = await linearizable(this.userModel.findById(userId)).exec();
      if (!user || user.isDeleted) {
        return [];
      }
      const userVersion = user.sessionVersion ?? 0;
      return this.sessionModel
        .find({
          user: userId,
          isValid: true,
          revokedAt: { $exists: false },
          expiresAt: { $gt: now },
          idleExpiresAt: { $gt: now },
          userVersion,
        })
        .sort({ lastUsedAt: -1 })
        .lean<LeanSession[]>()
        .exec();
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async getById(sessionId: string): Promise<LeanSession | null> {
    try {
      return this.sessionModel
        .findById(sessionId)
        .lean<LeanSession | null>()
        .exec();
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async getByToken(token: string): Promise<LeanSession | null> {
    try {
      return this.sessionModel
        .findOne({ tokenHash: hashToken(token) })
        .lean<LeanSession | null>()
        .exec();
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  private async validateAuthoritative(
    token: string,
    extendIdle: boolean,
  ): Promise<LeanSession | null> {
    const session = await linearizable(
      this.sessionModel.findOne({ tokenHash: hashToken(token) }),
    ).exec();
    if (!session || !this.hasRequiredAuthorityFields(session)) {
      return null;
    }
    if (
      !session.isValid ||
      session.revokedAt ||
      session.credentialPurpose !== CREDENTIAL_PURPOSE.BROWSER_SESSION
    ) {
      return null;
    }
    if (session.authEpoch !== this.authEpoch.current()) {
      return null;
    }
    if (session.schemaVersion !== AUTH_SCHEMA_VERSION) {
      return null;
    }

    const user = await linearizable(
      this.userModel.findById(session.user),
    ).exec();
    if (!user || user.isDeleted) {
      return null;
    }
    if ((session.userVersion ?? -1) !== (user.sessionVersion ?? 0)) {
      return null;
    }

    const application = await this.applications.findByClientId(
      session.clientId,
    );
    if (!application || !application.enabled) {
      return null;
    }
    if ((session.clientVersion ?? -1) !== (application.sessionVersion ?? 0)) {
      return null;
    }

    const grant = await linearizable(
      this.grantModel.findOne({
        userId: user._id,
        clientId: session.clientId,
      }),
    ).exec();
    if (!grant || !grant.allowed) {
      return null;
    }
    if ((session.grantVersion ?? -1) !== (grant.sessionVersion ?? 0)) {
      return null;
    }

    const now = this.clock.now();
    const policyAbsolute = addMs(
      session.authenticatedAt,
      application.policy.absoluteLifetimeMs,
    );
    const policyIdle = addMs(
      session.lastActivityAt,
      application.policy.idleLifetimeMs,
    );
    const absolute = effectiveDeadline(session.expiresAt, policyAbsolute);
    const idle = effectiveDeadline(session.idleExpiresAt, policyIdle);
    if (isDeadlinePassed(now, absolute) || isDeadlinePassed(now, idle)) {
      return null;
    }

    if (extendIdle) {
      await this.maybeExtendIdle(
        session,
        now,
        absolute,
        idle,
        application.policy.idleLifetimeMs,
      );
    }

    const lean = session.toObject() as LeanSession;
    lean.user = { ...user.toObject() };
    return lean;
  }

  private hasRequiredAuthorityFields(session: SessionDocument): boolean {
    return Boolean(
      session.clientId &&
      session.authenticatedAt &&
      session.idleExpiresAt &&
      session.lastActivityAt &&
      typeof session.userVersion === 'number' &&
      typeof session.clientVersion === 'number' &&
      typeof session.grantVersion === 'number' &&
      typeof session.authEpoch === 'number' &&
      typeof session.schemaVersion === 'number',
    );
  }

  private async maybeExtendIdle(
    session: SessionDocument,
    now: Date,
    absolute: Date,
    idle: Date,
    idleLifetimeMs: number,
  ): Promise<void> {
    const lastActivity = session.lastActivityAt.getTime();
    const remainingIdle = idle.getTime() - now.getTime();
    const stale =
      now.getTime() - lastActivity > SESSION_LAST_USED_UPDATE_INTERVAL_MS;
    if (!stale && remainingIdle > SESSION_LAST_USED_UPDATE_INTERVAL_MS) {
      return;
    }

    const nextIdle = capIdleByAbsolute(addMs(now, idleLifetimeMs), absolute);
    const result = await this.sessionModel.updateOne(
      {
        _id: session._id,
        isValid: true,
        revokedAt: { $exists: false },
        idleExpiresAt: { $gt: now },
        expiresAt: { $gt: now },
      },
      {
        $set: {
          lastUsedAt: now,
          lastActivityAt: now,
          idleExpiresAt: nextIdle,
        },
      },
    );
    if (result.modifiedCount > 0) {
      session.lastUsedAt = now;
      session.lastActivityAt = now;
      session.idleExpiresAt = nextIdle;
    }
  }
}
