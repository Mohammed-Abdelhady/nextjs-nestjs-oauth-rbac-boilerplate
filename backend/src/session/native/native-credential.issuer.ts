import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model, Types } from 'mongoose';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { parseUserAgent } from '../../common/utils/parse-user-agent';
import { UserDocument } from '../../user/schemas/user.schema';
import { DEFAULT_API_AUDIENCE } from '../constants/client-ids';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import {
  AUTH_SCHEMA_VERSION,
  DEVICE_NAME_MAX_LENGTH,
  NATIVE_ACCESS_LIFETIME_MS,
  NATIVE_INITIAL_IDLE_MS,
  USER_AGENT_MAX_LENGTH,
} from '../constants/session-policy';
import { ApplicationDocument } from '../schemas/application.schema';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import { UserApplicationGrantDocument } from '../schemas/user-application-grant.schema';
import { boundLabel } from '../utils/bound-label';
import { addMs, capIdleByAbsolute } from '../utils/session-deadline';
import { hashToken, randomSecret } from '../utils/token-hash';
import { SecurityEventService } from '../services/security-event.service';
import { ClientMeta, TokenSuccess } from './native-oauth.types';

export interface NativeGrantContext {
  clientId: string;
  requestedScopes: string[];
  audience?: string;
  authenticationMethods?: string[];
}

@Injectable()
export class NativeCredentialIssuer {
  constructor(
    @InjectModel(NativeCredential.name)
    private readonly credentials: Model<NativeCredentialDocument>,
    @InjectModel(Session.name)
    private readonly sessions: Model<SessionDocument>,
    private readonly events: SecurityEventService,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async issuePair(
    db: ClientSession,
    user: UserDocument,
    application: ApplicationDocument,
    grant: UserApplicationGrantDocument,
    pending: NativeGrantContext,
    meta: ClientMeta,
    now: Date,
    generation: number,
    existing?: SessionDocument,
    familyId = randomSecret(),
  ): Promise<TokenSuccess> {
    const absoluteExpiresAt = existing
      ? existing.expiresAt
      : addMs(now, application.policy.absoluteLifetimeMs);
    const idleExpiresAt = existing
      ? existing.idleExpiresAt
      : capIdleByAbsolute(
          addMs(now, NATIVE_INITIAL_IDLE_MS),
          absoluteExpiresAt,
        );
    let sessionId = existing?._id;
    if (!sessionId) {
      const device = parseUserAgent(meta.userAgent);
      const [created] = await this.sessions.create(
        [
          {
            user: user._id,
            tokenHash: hashToken(randomSecret()),
            userAgent:
              boundLabel(meta.userAgent, USER_AGENT_MAX_LENGTH) || 'native',
            device,
            deviceName:
              boundLabel(device.name ?? '', DEVICE_NAME_MAX_LENGTH) ||
              undefined,
            ip: meta.ip || 'unknown',
            isValid: true,
            lastUsedAt: now,
            expiresAt: absoluteExpiresAt,
            schemaVersion: AUTH_SCHEMA_VERSION,
            authEpoch: this.authEpoch.current(),
            clientId: pending.clientId,
            userVersion: user.sessionVersion ?? 0,
            clientVersion: application.sessionVersion ?? 0,
            grantVersion: grant.sessionVersion ?? 0,
            scopes: pending.requestedScopes,
            audience: pending.audience || DEFAULT_API_AUDIENCE,
            authenticationMethods: pending.authenticationMethods ?? [],
            authenticatedAt: now,
            idleExpiresAt,
            lastActivityAt: now,
            credentialPurpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS,
          },
        ],
        { session: db },
      );
      sessionId = created._id;
      await this.events.record(
        {
          targetUserId: user._id.toString(),
          clientId: pending.clientId,
          sessionId: sessionId.toString(),
          action: SECURITY_EVENT_ACTION.SESSION_ISSUED,
        },
        db,
      );
    }
    const accessToken = randomSecret();
    const refreshToken = randomSecret();
    const accessExpiresAt = capIdleByAbsolute(
      addMs(now, NATIVE_ACCESS_LIFETIME_MS),
      absoluteExpiresAt,
    );
    await this.credentials.create(
      [
        {
          tokenHash: hashToken(accessToken),
          purpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS,
          sessionId,
          clientId: pending.clientId,
          generation,
          familyId,
          issuedAt: now,
          expiresAt: accessExpiresAt,
          spent: false,
        },
        {
          tokenHash: hashToken(refreshToken),
          purpose: CREDENTIAL_PURPOSE.NATIVE_REFRESH,
          sessionId,
          clientId: pending.clientId,
          generation,
          familyId,
          issuedAt: now,
          expiresAt: absoluteExpiresAt,
          spent: false,
        },
      ],
      { session: db, ordered: true },
    );
    return {
      ok: true,
      accessToken,
      refreshToken,
      expiresIn: Math.floor((accessExpiresAt.getTime() - now.getTime()) / 1000),
      scope: pending.requestedScopes.join(' '),
    };
  }

  async revokeFamily(
    db: ClientSession,
    familyId: string,
    sessionId: Types.ObjectId,
    now: Date,
  ): Promise<void> {
    await this.sessions
      .updateOne(
        { _id: sessionId },
        {
          $set: {
            isValid: false,
            revokedAt: now,
            revokedReason: SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
          },
        },
      )
      .session(db)
      .exec();
    await this.credentials
      .updateMany(
        { familyId, sessionId },
        { $set: { spent: true, revokedAt: now } },
      )
      .session(db)
      .exec();
    await this.events.record(
      {
        sessionId: sessionId.toString(),
        action: SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
      },
      db,
    );
  }
}
