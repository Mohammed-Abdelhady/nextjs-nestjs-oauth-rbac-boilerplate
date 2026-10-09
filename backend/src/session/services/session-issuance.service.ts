import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { Clock } from '../../common/services/clock';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { parseUserAgent } from '../../common/utils/parse-user-agent';
import { User, UserDocument } from '../../user/schemas/user.schema';
import {
  ADMIN_CLIENT_ID,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
  WEB_CLIENT_ID,
} from '../constants/client-ids';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import {
  AUTH_SCHEMA_VERSION,
  DEVICE_NAME_MAX_LENGTH,
  MAX_ADMIN_SESSIONS_PER_USER,
  MAX_SESSIONS_PER_USER,
  NATIVE_INITIAL_IDLE_MS,
  USER_AGENT_MAX_LENGTH,
} from '../constants/session-policy';
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
import { boundLabel } from '../utils/session/bound-label';
import { addMs, capIdleByAbsolute } from '../utils/session/session-deadline';
import { withMajorityTransaction } from '../utils/transactions/mongo-transaction';
import { asAuthorityUnavailable } from '../utils/authority/authority-unavailable';
import { hashToken, randomSecret } from '../utils/hashing/token-hash';
import {
  currentSessionCandidateFilter,
  currentSessionDeadlines,
} from '../utils/authority/current-session-authority';
import { ApplicationRegistryService } from './application-registry.service';
import { SecurityEventService } from './security-event.service';

export interface IssuedBrowserSession {
  sessionToken: string;
  csrfToken: string;
}

@Injectable()
export class SessionIssuanceService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grantModel: Model<UserApplicationGrantDocument>,
    private readonly applications: ApplicationRegistryService,
    private readonly events: SecurityEventService,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async createBrowserSession(
    userId: Types.ObjectId,
    userAgent: string,
    ip: string,
    clientId = WEB_CLIENT_ID,
  ): Promise<IssuedBrowserSession> {
    try {
      return await withMajorityTransaction(this.connection, (session) =>
        this.issueInTransaction(session, userId, userAgent, ip, clientId),
      );
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  private async issueInTransaction(
    session: ClientSession,
    userId: Types.ObjectId,
    userAgent: string,
    ip: string,
    clientId: string,
  ): Promise<IssuedBrowserSession> {
    const user = await this.userModel.findById(userId).session(session).exec();
    if (!user || user.isDeleted) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const application = await this.applications.requireEnabled(
      clientId,
      session,
    );
    this.assertNativeAllowed(application);

    await this.userModel
      .updateOne({ _id: userId }, { $inc: { issuanceFence: 1 } })
      .session(session)
      .exec();

    const grant = await this.requireOrCreateGrant(
      session,
      userId,
      clientId,
      application,
    );
    await this.grantModel
      .updateOne({ _id: grant._id }, { $inc: { issuanceFence: 1 } })
      .session(session)
      .exec();

    const now = this.clock.now();
    await this.assertSessionLimit(session, user, application, now);

    const token = randomSecret();
    const csrfToken = randomSecret();
    const absoluteExpiresAt = addMs(now, application.policy.absoluteLifetimeMs);
    const idleMs =
      application.platform === APPLICATION_PLATFORM.NATIVE
        ? NATIVE_INITIAL_IDLE_MS
        : application.policy.idleLifetimeMs;
    const idleExpiresAt = capIdleByAbsolute(
      addMs(now, idleMs),
      absoluteExpiresAt,
    );
    const device = parseUserAgent(userAgent);
    const boundedAgent =
      boundLabel(userAgent, USER_AGENT_MAX_LENGTH) || 'unknown';
    const deviceName = boundLabel(device.name, DEVICE_NAME_MAX_LENGTH);

    const [created] = await this.sessionModel.create(
      [
        {
          user: userId,
          tokenHash: hashToken(token),
          userAgent: boundedAgent,
          device,
          deviceName: deviceName || undefined,
          ip,
          isValid: true,
          lastUsedAt: now,
          expiresAt: absoluteExpiresAt,
          schemaVersion: AUTH_SCHEMA_VERSION,
          authEpoch: this.authEpoch.current(),
          clientId,
          userVersion: user.sessionVersion ?? 0,
          clientVersion: application.sessionVersion ?? 0,
          grantVersion: grant.sessionVersion ?? 0,
          scopes: [DEFAULT_API_AUDIENCE],
          audience: DEFAULT_API_AUDIENCE,
          authenticationMethods: [],
          authenticatedAt: now,
          idleExpiresAt,
          lastActivityAt: now,
          credentialPurpose: CREDENTIAL_PURPOSE.BROWSER_SESSION,
          browserGeneration: 1,
          csrfToken,
        },
      ],
      { session },
    );

    await this.events.record(
      {
        targetUserId: userId.toString(),
        clientId,
        sessionId: created._id.toString(),
        action: SECURITY_EVENT_ACTION.SESSION_ISSUED,
      },
      session,
    );

    return { sessionToken: token, csrfToken };
  }

  private assertNativeAllowed(application: ApplicationDocument): void {
    if (application.platform !== APPLICATION_PLATFORM.NATIVE) {
      return;
    }
    if (!this.authEpoch.nativeEnabled()) {
      throw new AppException(
        ErrorCode.FEATURE_DISABLED,
        'Native session issuance is disabled',
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async requireOrCreateGrant(
    session: ClientSession,
    userId: Types.ObjectId,
    clientId: string,
    application: ApplicationDocument,
  ): Promise<UserApplicationGrantDocument> {
    const existing = await this.grantModel
      .findOne({ userId, clientId })
      .session(session)
      .exec();
    if (existing && !existing.allowed) {
      throw new AppException(
        ErrorCode.GRANT_BLOCKED,
        'Application access is blocked for this account',
        HttpStatus.FORBIDDEN,
      );
    }
    if (existing) {
      return existing;
    }

    if (application.platform === APPLICATION_PLATFORM.NATIVE) {
      throw new AppException(
        ErrorCode.GRANT_BLOCKED,
        'Application access is blocked for this account',
        HttpStatus.FORBIDDEN,
      );
    }

    const [created] = await this.grantModel.create(
      [
        {
          userId,
          clientId,
          allowedScopes: application.allowedScopes,
          allowed: true,
          sessionVersion: 0,
          issuanceFence: 0,
        },
      ],
      { session },
    );
    return created;
  }

  async assertSessionLimit(
    session: ClientSession,
    user: UserDocument,
    application: ApplicationDocument,
    now: Date,
  ): Promise<void> {
    const userVersion = user.sessionVersion ?? 0;
    const authEpoch = this.authEpoch.current();
    const candidates = await this.sessionModel
      .find(
        currentSessionCandidateFilter(user._id, now, userVersion, authEpoch, [
          CREDENTIAL_PURPOSE.BROWSER_SESSION,
          CREDENTIAL_PURPOSE.NATIVE_ACCESS,
        ]),
      )
      .session(session)
      .lean<LeanSession[]>()
      .exec();
    const clientIds = [
      ...new Set(candidates.map((candidate) => candidate.clientId)),
    ];
    const applications = await this.applications.findByClientIds(
      clientIds,
      session,
    );
    const grants =
      clientIds.length === 0
        ? []
        : await this.grantModel
            .find({ userId: user._id, clientId: { $in: clientIds } })
            .session(session)
            .lean<UserApplicationGrant[]>()
            .exec();
    const applicationByClientId = new Map<string, ApplicationDocument>();
    for (const currentApplication of applications) {
      applicationByClientId.set(
        currentApplication.clientId,
        currentApplication,
      );
    }
    const grantByClientId = new Map<string, UserApplicationGrant>();
    for (const grant of grants) {
      grantByClientId.set(grant.clientId, grant);
    }
    const activeSessions = candidates.filter(
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
    const total = activeSessions.length;
    if (total >= MAX_SESSIONS_PER_USER) {
      throw new AppException(
        ErrorCode.SESSION_LIMIT_REACHED,
        'Session limit reached',
        HttpStatus.CONFLICT,
      );
    }

    if (application.clientId !== ADMIN_CLIENT_ID) {
      return;
    }

    const adminCount = activeSessions.filter(
      (candidate) => candidate.clientId === ADMIN_CLIENT_ID,
    ).length;
    if (adminCount >= MAX_ADMIN_SESSIONS_PER_USER) {
      throw new AppException(
        ErrorCode.SESSION_LIMIT_REACHED,
        'Session limit reached',
        HttpStatus.CONFLICT,
      );
    }
  }
}
