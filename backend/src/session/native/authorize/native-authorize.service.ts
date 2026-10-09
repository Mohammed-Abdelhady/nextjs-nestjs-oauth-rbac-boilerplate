import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { randomUUID } from 'crypto';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { Clock } from '../../../common/services/clock';
import { AuthEpochService } from '../../../common/services/auth-epoch.service';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import {
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
} from '../../constants/client-ids';
import {
  AUTHORIZATION_CODE_LIFETIME_MS,
  PENDING_AUTH_LIFETIME_MS,
} from '../../constants/session-policy';
import {
  Application,
  ApplicationDocument,
} from '../../schemas/application.schema';
import {
  AuthorizationTransaction,
  AuthorizationTransactionDocument,
} from '../../schemas/authorization-transaction.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../../schemas/user-application-grant.schema';
import { isPkceVerifier } from '../../utils/oauth/pkce';
import { addMs } from '../../utils/session/session-deadline';
import { hashToken, randomSecret } from '../../utils/hashing/token-hash';
import { withMajorityTransaction } from '../../utils/transactions/mongo-transaction';
import { isAcceptableRedirectUri } from '../../utils/oauth/redirect-uri.util';
import type { RedirectUriPolicy } from '../../utils/oauth/redirect-uri.util';
import { matchesRegisteredRedirectUri } from '../../utils/oauth/redirect-uri.util';
import {
  AuthorizeBegin,
  NATIVE_AUTH_INTENT,
  OAUTH_ERROR,
  OauthFailure,
  oauthFailure,
} from '../oauth/native-oauth.types';
import { isValidAuthorizeQueryShape } from './native-authorize-query.util';

const STATE_MAX_LENGTH = 512;

@Injectable()
export class NativeAuthorizeService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(AuthorizationTransaction.name)
    private readonly transactions: Model<AuthorizationTransactionDocument>,
    @InjectModel(Application.name)
    private readonly applications: Model<ApplicationDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grants: Model<UserApplicationGrantDocument>,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async begin(query: unknown): Promise<AuthorizeBegin | OauthFailure> {
    if (!isValidAuthorizeQueryShape(query)) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    if (!this.authEpoch.nativeEnabled()) {
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.UNAUTHORIZED_CLIENT,
        ErrorCode.NATIVE_AUTH_DISABLED,
      );
    }
    if (query.response_type !== 'code') {
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.UNSUPPORTED_RESPONSE_TYPE,
      );
    }
    const clientId = query.client_id.trim();
    const redirectUri = query.redirect_uri;
    const challenge = query.code_challenge;
    if (
      !clientId ||
      !redirectUri ||
      query.code_challenge_method !== 'S256' ||
      !isPkceVerifier(challenge)
    ) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    const state = query.state;
    if (state.length > STATE_MAX_LENGTH) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }

    const application = await this.applications
      .findOne({ clientId, environment: this.authEpoch.environment() })
      .exec();
    const clientError = this.rejectClient(application, redirectUri);
    if (clientError) {
      return clientError;
    }
    const scopes = this.resolveScopes(application, query.scope);
    if (!scopes) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_SCOPE);
    }

    const now = this.clock.now();
    const transactionId = randomUUID();
    await this.transactions.create({
      transactionId,
      clientId,
      redirectUri,
      codeChallenge: challenge,
      state,
      requestedScopes: scopes,
      audience: DEFAULT_API_AUDIENCE,
      intent: NATIVE_AUTH_INTENT,
      expiresAt: addMs(now, PENDING_AUTH_LIFETIME_MS),
      consumed: false,
      authEpoch: this.authEpoch.current(),
    });
    return { ok: true, transactionId };
  }

  async approve(
    userId: string,
    transactionId: string,
    authenticationMethods: string[],
  ): Promise<{ redirectUri: string }> {
    if (!this.authEpoch.nativeEnabled()) {
      throw new AppException(
        ErrorCode.NATIVE_AUTH_DISABLED,
        'Native sign-in is disabled',
        HttpStatus.FORBIDDEN,
      );
    }
    if (!Types.ObjectId.isValid(userId) || !transactionId.trim()) {
      throw new AppException(
        ErrorCode.VALIDATION_ERROR,
        'Authorization approval is incomplete',
        HttpStatus.BAD_REQUEST,
      );
    }
    const approved = await withMajorityTransaction(
      this.connection,
      async (db) => {
        const now = this.clock.now();
        const user = await this.users.findById(userId).session(db).exec();
        if (!user || user.isDeleted) {
          throw new AppException(
            ErrorCode.USER_NOT_FOUND,
            'User not found',
            HttpStatus.NOT_FOUND,
          );
        }
        const pending = await this.transactions
          .findOne({
            transactionId,
            intent: NATIVE_AUTH_INTENT,
            consumed: false,
            codeHash: { $exists: false },
            expiresAt: { $gt: now },
          })
          .session(db)
          .exec();
        if (!pending) {
          throw expiredTransaction();
        }
        if (
          !isAcceptableRedirectUri(pending.redirectUri, this.redirectPolicy())
        ) {
          throw expiredTransaction();
        }
        const application = await this.applications
          .findOne({
            clientId: pending.clientId,
            environment: this.authEpoch.environment(),
            enabled: true,
          })
          .session(db)
          .exec();
        if (
          !application ||
          application.platform !== APPLICATION_PLATFORM.NATIVE ||
          application.clientType !== APPLICATION_CLIENT_TYPE.PUBLIC ||
          !application.redirectUris.some((registered) =>
            matchesRegisteredRedirectUri(registered, pending.redirectUri),
          )
        ) {
          throw expiredTransaction();
        }
        const code = randomSecret();
        const codeExpiresAt = addMs(now, AUTHORIZATION_CODE_LIFETIME_MS);
        const codeHash = hashToken(code);
        // Claim the transaction first so competing approvals cannot race on grant creation.
        const claimed = await this.transactions
          .updateOne(
            {
              _id: pending._id,
              consumed: false,
              codeHash: { $exists: false },
              expiresAt: { $gt: now },
            },
            {
              $set: {
                codeHash,
                codeExpiresAt,
                expiresAt: codeExpiresAt,
                userId: user._id,
                capturedUserVersion: user.sessionVersion ?? 0,
                capturedClientVersion: application.sessionVersion ?? 0,
                authenticationMethods: authenticationMethods.slice(0, 10),
              },
            },
          )
          .session(db)
          .exec();
        if (claimed.modifiedCount !== 1) {
          throw expiredTransaction();
        }
        const grant = await this.allowGrant(db, user._id, application);
        const capturedGrant = await this.transactions
          .updateOne(
            { _id: pending._id, consumed: false, codeHash },
            { $set: { capturedGrantVersion: grant.sessionVersion ?? 0 } },
          )
          .session(db)
          .exec();
        if (capturedGrant.modifiedCount !== 1) {
          throw expiredTransaction();
        }
        return { redirectUri: pending.redirectUri, state: pending.state, code };
      },
    );
    return {
      redirectUri: appendAuthorizationCode(
        approved.redirectUri,
        approved.code,
        approved.state,
      ),
    };
  }

  private redirectPolicy(): RedirectUriPolicy {
    return {
      nodeEnv: this.authEpoch.environment(),
      allowCustomScheme: this.authEpoch.nativeCustomSchemeAllowed(),
    };
  }

  private rejectClient(
    application: ApplicationDocument | null,
    redirectUri: string,
  ): OauthFailure | null {
    if (
      !application ||
      !application.enabled ||
      application.platform !== APPLICATION_PLATFORM.NATIVE ||
      application.clientType !== APPLICATION_CLIENT_TYPE.PUBLIC
    ) {
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.UNAUTHORIZED_CLIENT,
      );
    }
    if (
      !isAcceptableRedirectUri(redirectUri, this.redirectPolicy()) ||
      !application.redirectUris.some((registered) =>
        matchesRegisteredRedirectUri(registered, redirectUri),
      )
    ) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    return null;
  }

  private resolveScopes(
    application: ApplicationDocument | null,
    requested: string | undefined,
  ): string[] | null {
    if (!application) {
      return null;
    }
    const allowed = new Set(application.allowedScopes);
    if (!requested || requested.trim().length === 0) {
      return [...application.allowedScopes];
    }
    const scopes = requested.split(' ').filter((scope) => scope.length > 0);
    if (scopes.length === 0 || scopes.some((scope) => !allowed.has(scope))) {
      return null;
    }
    return scopes;
  }

  private async allowGrant(
    db: ClientSession,
    userId: Types.ObjectId,
    application: ApplicationDocument,
  ): Promise<UserApplicationGrantDocument> {
    const existing = await this.grants
      .findOne({ userId, clientId: application.clientId })
      .session(db)
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
    const [created] = await this.grants.create(
      [
        {
          userId,
          clientId: application.clientId,
          allowedScopes: application.allowedScopes,
          allowed: true,
          sessionVersion: 0,
          issuanceFence: 0,
        },
      ],
      { session: db },
    );
    return created;
  }
}

function appendAuthorizationCode(
  redirectUri: string,
  code: string,
  state: string,
): string {
  const target = new URL(redirectUri);
  target.searchParams.set('code', code);
  target.searchParams.set('state', state);
  return target.toString();
}

function expiredTransaction(): AppException {
  return new AppException(
    ErrorCode.NATIVE_TRANSACTION_EXPIRED,
    'Native authorization transaction is expired or already ended',
    HttpStatus.NOT_FOUND,
  );
}
