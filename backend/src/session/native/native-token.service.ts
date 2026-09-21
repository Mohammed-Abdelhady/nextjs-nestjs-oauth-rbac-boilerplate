import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Clock } from '../../common/services/clock';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { APPLICATION_PLATFORM } from '../constants/client-ids';
import { MAX_SESSIONS_PER_USER } from '../constants/session-policy';
import {
  Application,
  ApplicationDocument,
} from '../schemas/application.schema';
import {
  AuthorizationTransaction,
  AuthorizationTransactionDocument,
} from '../schemas/authorization-transaction.schema';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../schemas/user-application-grant.schema';
import { asAuthorityUnavailable } from '../utils/authority-unavailable';
import { pkceMatches } from '../utils/pkce';
import { withMajorityTransaction } from '../utils/mongo-transaction';
import { hashToken } from '../utils/token-hash';
import { NativeCredentialIssuer } from './native-credential.issuer';
import { NativeRefreshService } from './native-refresh.service';
import {
  ClientMeta,
  OAUTH_ERROR,
  OauthFailure,
  RevokeRequest,
  RevokeSuccess,
  TokenRequest,
  TokenSuccess,
  oauthFailure,
} from './native-oauth.types';

@Injectable()
export class NativeTokenService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(AuthorizationTransaction.name)
    private readonly transactions: Model<AuthorizationTransactionDocument>,
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
    private readonly refreshes: NativeRefreshService,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async grant(
    body: TokenRequest,
    meta: ClientMeta,
  ): Promise<TokenSuccess | OauthFailure> {
    if (body.client_secret) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_CLIENT);
    }
    if (!this.authEpoch.nativeEnabled()) {
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.UNAUTHORIZED_CLIENT,
      );
    }
    try {
      if (body.grant_type === 'authorization_code') {
        return await this.exchange(body, meta);
      }
      if (body.grant_type === 'refresh_token') {
        return await this.refreshes.rotate(
          body.refresh_token ?? '',
          body.client_id ?? '',
          meta,
        );
      }
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.UNSUPPORTED_GRANT_TYPE,
      );
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  async revoke(body: RevokeRequest): Promise<RevokeSuccess | OauthFailure> {
    if (body.client_secret) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_CLIENT);
    }
    const token = body.token?.trim() ?? '';
    if (!token) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    try {
      await withMajorityTransaction(this.connection, async (db) => {
        const credential = await this.credentials
          .findOne({ tokenHash: hashToken(token) })
          .session(db)
          .exec();
        if (!credential) {
          return;
        }
        if (body.client_id && body.client_id !== credential.clientId) {
          return;
        }
        const now = this.clock.now();
        await this.issuer.revokeFamily(
          db,
          credential.familyId,
          credential.sessionId,
          now,
        );
      });
      return { ok: true };
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }

  private async exchange(
    body: TokenRequest,
    meta: ClientMeta,
  ): Promise<TokenSuccess | OauthFailure> {
    const code = body.code?.trim() ?? '';
    const clientId = body.client_id?.trim() ?? '';
    const redirectUri = body.redirect_uri ?? '';
    const verifier = body.code_verifier ?? '';
    if (!code || !clientId || !redirectUri || !verifier) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    const pending = await this.transactions
      .findOne({ codeHash: hashToken(code), consumed: false })
      .exec();
    if (
      !pending ||
      pending.clientId !== clientId ||
      pending.redirectUri !== redirectUri ||
      !pending.userId ||
      !pending.codeExpiresAt ||
      pending.codeExpiresAt.getTime() <= this.clock.now().getTime()
    ) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    if (!pkceMatches(verifier, pending.codeChallenge)) {
      await this.transactions.updateOne(
        { _id: pending._id, consumed: false },
        { $set: { consumed: true } },
      );
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    return withMajorityTransaction(this.connection, (db) =>
      this.consumeCode(db, pending._id, meta),
    );
  }

  private async consumeCode(
    db: ClientSession,
    transactionId: Types.ObjectId,
    meta: ClientMeta,
  ): Promise<TokenSuccess | OauthFailure> {
    const now = this.clock.now();
    const pending = await this.transactions
      .findOne({ _id: transactionId, consumed: false })
      .session(db)
      .exec();
    if (!pending || !pending.userId || !pending.codeExpiresAt) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    if (pending.codeExpiresAt.getTime() <= now.getTime()) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    const claimed = await this.transactions
      .updateOne(
        { _id: pending._id, consumed: false },
        { $set: { consumed: true } },
      )
      .session(db)
      .exec();
    if (claimed.modifiedCount !== 1) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    const user = await this.users.findById(pending.userId).session(db).exec();
    const application = await this.applications
      .findOne({
        clientId: pending.clientId,
        environment: this.authEpoch.environment(),
      })
      .session(db)
      .exec();
    const grant = await this.grants
      .findOne({ userId: pending.userId, clientId: pending.clientId })
      .session(db)
      .exec();
    if (
      !user ||
      user.isDeleted ||
      !application ||
      !application.enabled ||
      application.platform !== APPLICATION_PLATFORM.NATIVE ||
      !grant ||
      !grant.allowed ||
      (user.sessionVersion ?? 0) !== (pending.capturedUserVersion ?? -1) ||
      (application.sessionVersion ?? 0) !==
        (pending.capturedClientVersion ?? -1) ||
      (grant.sessionVersion ?? 0) !== (pending.capturedGrantVersion ?? -1) ||
      pending.authEpoch !== this.authEpoch.current()
    ) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    const active = await this.sessions
      .countDocuments({
        user: user._id,
        isValid: true,
        revokedAt: { $exists: false },
        expiresAt: { $gt: now },
        idleExpiresAt: { $gt: now },
        userVersion: user.sessionVersion ?? 0,
      })
      .session(db)
      .exec();
    if (active >= MAX_SESSIONS_PER_USER) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.ACCESS_DENIED);
    }
    return this.issuer.issuePair(
      db,
      user,
      application,
      grant,
      pending,
      meta,
      now,
      1,
    );
  }
}
