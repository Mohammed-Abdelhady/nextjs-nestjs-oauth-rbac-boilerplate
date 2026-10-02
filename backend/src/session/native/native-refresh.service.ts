import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { Clock } from '../../common/services/clock';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { APPLICATION_PLATFORM } from '../constants/client-ids';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import {
  Application,
  ApplicationDocument,
} from '../schemas/application.schema';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../schemas/user-application-grant.schema';
import { withMajorityTransaction } from '../utils/mongo-transaction';
import { currentSessionDeadlines } from '../utils/current-session-authority';
import { hashToken } from '../utils/token-hash';
import { NativeCredentialIssuer } from './native-credential.issuer';
import {
  ClientMeta,
  OAUTH_ERROR,
  OauthFailure,
  TokenSuccess,
  oauthFailure,
} from './native-oauth.types';

@Injectable()
export class NativeRefreshService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(NativeCredential.name)
    private readonly credentials: Model<NativeCredentialDocument>,
    @InjectModel(Session.name)
    private readonly sessions: Model<SessionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Application.name)
    private readonly applications: Model<ApplicationDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grants: Model<UserApplicationGrantDocument>,
    private readonly issuer: NativeCredentialIssuer,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async rotate(
    refreshToken: string,
    clientId: string,
    meta: ClientMeta,
  ): Promise<TokenSuccess | OauthFailure> {
    const presentedToken = refreshToken.trim();
    const presentedClient = clientId.trim();
    if (!presentedToken || !presentedClient) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    return withMajorityTransaction(this.connection, async (db) => {
      const now = this.clock.now();
      const presented = await this.credentials
        .findOne({ tokenHash: hashToken(presentedToken) })
        .session(db)
        .exec();
      if (
        !presented ||
        presented.purpose !== CREDENTIAL_PURPOSE.NATIVE_REFRESH ||
        presented.clientId !== presentedClient
      ) {
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      if (presented.revokedAt) {
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      if (presented.spent) {
        await this.issuer.revokeFamily(
          db,
          presented.familyId,
          presented.sessionId,
          now,
          SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
        );
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      if (presented.expiresAt.getTime() <= now.getTime()) {
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      const session = await this.sessions
        .findById(presented.sessionId)
        .session(db)
        .exec();
      if (!session || session.clientId !== presentedClient) {
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      const user = await this.users.findById(session.user).session(db).exec();
      const application = await this.applications
        .findOne({
          clientId: presentedClient,
          environment: this.authEpoch.environment(),
        })
        .session(db)
        .exec();
      const grant = user
        ? await this.grants
            .findOne({ userId: user._id, clientId: presentedClient })
            .session(db)
            .exec()
        : null;
      if (
        !user ||
        !application ||
        application.platform !== APPLICATION_PLATFORM.NATIVE ||
        !grant ||
        !currentSessionDeadlines(
          session,
          user,
          application,
          grant,
          now,
          this.authEpoch.current(),
          CREDENTIAL_PURPOSE.NATIVE_ACCESS,
        )
      ) {
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      const claimed = await this.credentials
        .updateOne(
          { _id: presented._id, spent: false },
          { $set: { spent: true, consumedAt: now } },
        )
        .session(db)
        .exec();
      if (claimed.modifiedCount !== 1) {
        await this.issuer.revokeFamily(
          db,
          presented.familyId,
          presented.sessionId,
          now,
          SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
        );
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
      }
      await this.credentials
        .updateMany(
          {
            familyId: presented.familyId,
            sessionId: presented.sessionId,
            purpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS,
            spent: false,
          },
          { $set: { spent: true, revokedAt: now } },
        )
        .session(db)
        .exec();
      return this.issuer.issuePair(
        db,
        user,
        application,
        grant,
        {
          clientId: presentedClient,
          requestedScopes: session.scopes,
          audience: session.audience,
          authenticationMethods: session.authenticationMethods,
        },
        meta,
        now,
        presented.generation + 1,
        session,
        presented.familyId,
      );
    });
  }
}
