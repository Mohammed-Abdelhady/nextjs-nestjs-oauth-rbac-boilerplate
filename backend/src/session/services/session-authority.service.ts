import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SESSION_LAST_USED_UPDATE_INTERVAL_MS } from '../../common/constants/session';
import { Clock } from '../../common/services/clock';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import {
  CREDENTIAL_PURPOSE,
  CredentialPurpose,
} from '../constants/credential-purpose';
import { AUTH_SCHEMA_VERSION } from '../constants/session-policy';
import { ApplicationDocument } from '../schemas/application.schema';
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
import { addMs, capIdleByAbsolute } from '../utils/session-deadline';
import {
  currentSessionCandidateFilter,
  currentSessionDeadlines,
  isValidDate,
} from '../utils/current-session-authority';
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
      const authEpoch = this.authEpoch.current();
      const candidates = await this.sessionModel
        .find(
          currentSessionCandidateFilter(userId, now, userVersion, authEpoch, [
            CREDENTIAL_PURPOSE.BROWSER_SESSION,
            CREDENTIAL_PURPOSE.NATIVE_ACCESS,
          ]),
        )
        .sort({ lastUsedAt: -1 })
        .lean<LeanSession[]>()
        .exec();
      const clientIds = [
        ...new Set(candidates.map((session) => session.clientId)),
      ];
      const [applications, grants] = await Promise.all([
        this.applications.findByClientIds(clientIds),
        clientIds.length === 0
          ? Promise.resolve<UserApplicationGrant[]>([])
          : linearizable(
              this.grantModel.find({
                userId,
                clientId: { $in: clientIds },
              }),
            )
              .lean<UserApplicationGrant[]>()
              .exec(),
      ]);
      const applicationByClientId = new Map<string, ApplicationDocument>();
      for (const application of applications) {
        applicationByClientId.set(application.clientId, application);
      }
      const grantByClientId = new Map<string, UserApplicationGrant>();
      for (const grant of grants) {
        grantByClientId.set(grant.clientId, grant);
      }

      return candidates.filter(
        (candidate) =>
          currentSessionDeadlines(
            candidate,
            user,
            applicationByClientId.get(candidate.clientId),
            grantByClientId.get(candidate.clientId),
            now,
            authEpoch,
            candidate.credentialPurpose,
          ) !== null,
      );
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async getById(sessionId: string): Promise<LeanSession | null> {
    try {
      return await this.sessionModel
        .findById(sessionId)
        .lean<LeanSession | null>()
        .exec();
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async getByToken(token: string): Promise<LeanSession | null> {
    try {
      return await this.sessionModel
        .findOne({ tokenHash: hashToken(token) })
        .lean<LeanSession | null>()
        .exec();
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async validateById(
    sessionId: Types.ObjectId,
    extendIdle: boolean,
  ): Promise<LeanSession | null> {
    try {
      const session = await linearizable(
        this.sessionModel.findById(sessionId),
      ).exec();
      return await this.authorizeLoaded(
        session,
        extendIdle,
        CREDENTIAL_PURPOSE.NATIVE_ACCESS,
      );
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
    return this.authorizeLoaded(
      session,
      extendIdle,
      CREDENTIAL_PURPOSE.BROWSER_SESSION,
    );
  }

  private async authorizeLoaded(
    session: SessionDocument | null,
    extendIdle: boolean,
    purpose: CredentialPurpose,
  ): Promise<LeanSession | null> {
    if (!session || !this.hasRequiredAuthorityFields(session)) {
      return null;
    }
    if (
      !session.isValid ||
      session.revokedAt ||
      session.credentialPurpose !== purpose
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

    const now = this.clock.now();
    const deadlines = currentSessionDeadlines(
      session,
      user,
      application,
      grant,
      now,
      this.authEpoch.current(),
      purpose,
    );
    if (!deadlines) {
      return null;
    }

    if (extendIdle) {
      await this.maybeExtendIdle(
        session,
        now,
        deadlines.absolute,
        deadlines.idle,
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
      isValidDate(session.authenticatedAt) &&
      isValidDate(session.expiresAt) &&
      isValidDate(session.idleExpiresAt) &&
      isValidDate(session.lastActivityAt) &&
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
