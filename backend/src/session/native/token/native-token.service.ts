import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { Clock } from '../../../common/services/clock';
import { AuthEpochService } from '../../../common/services/auth-epoch.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import { APPLICATION_PLATFORM } from '../../constants/client-ids';
import {
  SECURITY_EVENT_ACTION,
  SECURITY_EVENT_OUTCOME,
} from '../../constants/security-event-action';
import { NATIVE_DPOP_FAILURE_REASON } from '../../constants/session-policy';
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
import { asAuthorityUnavailable } from '../../utils/authority/authority-unavailable';
import { pkceMatches } from '../../utils/oauth/pkce';
import { withMajorityTransaction } from '../../utils/transactions/mongo-transaction';
import { hashToken } from '../../utils/hashing/token-hash';
import { NativeCredentialIssuer } from './native-credential.issuer';
import { NativeRefreshService } from '../refresh/native-refresh.service';
import { NativeRevokeService } from '../revoke/native-revoke.service';
import {
  toIssuanceAccount,
  toIssuanceApplication,
} from '../../persistence/mongo/mongo-issuance-mappers';
import { mongoUnitOfWork } from '../../persistence/mongo/mongo-unit-of-work';
import { SessionIssuanceService } from '../../services/session-issuance.service';
import { SecurityEventService } from '../../services/security-event.service';
import { NativeDpopProofResult } from '../proof/native-dpop-proof';
import {
  TOKEN_REQUEST_FIELDS,
  readStringFields,
} from '../oauth/native-request-shape';
import {
  isNativeDpopProofIdConflict,
  NativeDpopService,
} from '../proof/native-dpop.service';
import {
  ClientMeta,
  OAUTH_ERROR,
  OauthFailure,
  RevokeSuccess,
  TokenRequest,
  TokenSuccess,
  oauthFailure,
} from '../oauth/native-oauth.types';

@Injectable()
export class NativeTokenService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(AuthorizationTransaction.name)
    private readonly transactions: Model<AuthorizationTransactionDocument>,
    @InjectModel(User.name) private readonly users: Model<UserDocument>,
    @InjectModel(Application.name)
    private readonly applications: Model<ApplicationDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grants: Model<UserApplicationGrantDocument>,
    private readonly issuer: NativeCredentialIssuer,
    private readonly refreshes: NativeRefreshService,
    private readonly revocations: NativeRevokeService,
    private readonly sessionIssuance: SessionIssuanceService,
    private readonly dpop: NativeDpopService,
    private readonly events: SecurityEventService,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async grant(
    request: unknown,
    meta: ClientMeta,
    dpopProof?: string,
  ): Promise<TokenSuccess | OauthFailure> {
    if (!this.authEpoch.nativeEnabled()) {
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.UNAUTHORIZED_CLIENT,
        ErrorCode.NATIVE_AUTH_DISABLED,
      );
    }
    const body = readStringFields(request, TOKEN_REQUEST_FIELDS);
    if (!body) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    if (body.client_secret) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_CLIENT);
    }
    if (body.grant_type === 'authorization_code') {
      return this.exchange(body, meta, dpopProof);
    }
    if (body.grant_type === 'refresh_token') {
      return this.refreshes.rotate(
        body.refresh_token ?? '',
        body.client_id ?? '',
        meta,
        dpopProof,
      );
    }
    return oauthFailure(
      HttpStatus.BAD_REQUEST,
      OAUTH_ERROR.UNSUPPORTED_GRANT_TYPE,
    );
  }

  async revoke(
    body: unknown,
    dpopProof?: string,
  ): Promise<RevokeSuccess | OauthFailure> {
    return this.revocations.revoke(body, dpopProof);
  }

  private async exchange(
    body: TokenRequest,
    meta: ClientMeta,
    dpopProof?: string,
  ): Promise<TokenSuccess | OauthFailure> {
    const code = body.code?.trim() ?? '';
    const clientId = body.client_id?.trim() ?? '';
    const redirectUri = body.redirect_uri ?? '';
    const verifier = body.code_verifier ?? '';
    if (!code || !clientId || !redirectUri || !verifier) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    if (dpopProof === undefined && this.authEpoch.nativeDpopRequired()) {
      const now = this.clock.now();
      await this.recordProofRefusal(
        code,
        NATIVE_DPOP_FAILURE_REASON.REQUIRED,
        now,
      );
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.INVALID_DPOP_PROOF,
        NATIVE_DPOP_FAILURE_REASON.REQUIRED,
      );
    }
    let verifiedProof: Extract<NativeDpopProofResult, { ok: true }> | undefined;
    if (dpopProof !== undefined) {
      const proofNow = this.clock.now();
      const verification = this.dpop.verifyExchangeProof(dpopProof, proofNow);
      if (!verification.result.ok) {
        await this.recordProofRefusal(
          code,
          verification.result.reason,
          proofNow,
        );
        const failure = oauthFailure(
          HttpStatus.BAD_REQUEST,
          verification.challengeNonce
            ? OAUTH_ERROR.USE_DPOP_NONCE
            : OAUTH_ERROR.INVALID_DPOP_PROOF,
          verification.result.reason,
        );
        return verification.challengeNonce
          ? { ...failure, dpopNonce: verification.challengeNonce }
          : failure;
      }
      verifiedProof = verification.result;
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
    try {
      return await withMajorityTransaction(this.connection, (db) =>
        this.consumeCode(db, pending._id, meta, verifiedProof),
      );
    } catch (error) {
      if (isNativeDpopProofIdConflict(error)) {
        await this.recordProofRefusal(
          code,
          ErrorCode.NATIVE_DPOP_PROOF_REPLAYED,
          this.clock.now(),
        );
        return oauthFailure(
          HttpStatus.BAD_REQUEST,
          OAUTH_ERROR.INVALID_DPOP_PROOF,
          ErrorCode.NATIVE_DPOP_PROOF_REPLAYED,
        );
      }
      if (
        error instanceof AppException &&
        error.getCode() === ErrorCode.SESSION_LIMIT_REACHED
      ) {
        return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.ACCESS_DENIED);
      }
      asAuthorityUnavailable(error);
    }
  }

  private async consumeCode(
    db: ClientSession,
    transactionId: Types.ObjectId,
    meta: ClientMeta,
    proof?: Extract<NativeDpopProofResult, { ok: true }>,
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
    const validAuthority = Boolean(
      user &&
      !user.isDeleted &&
      application &&
      application.enabled &&
      application.platform === APPLICATION_PLATFORM.NATIVE &&
      grant &&
      grant.allowed &&
      (user.sessionVersion ?? 0) === (pending.capturedUserVersion ?? -1) &&
      (application.sessionVersion ?? 0) ===
        (pending.capturedClientVersion ?? -1) &&
      (grant.sessionVersion ?? 0) === (pending.capturedGrantVersion ?? -1) &&
      pending.authEpoch === this.authEpoch.current(),
    );
    if (validAuthority && user && application && grant) {
      await this.users
        .updateOne({ _id: user._id }, { $inc: { issuanceFence: 1 } })
        .session(db)
        .exec();
      await this.sessionIssuance.assertSessionLimit(
        mongoUnitOfWork(db),
        toIssuanceAccount(user),
        toIssuanceApplication(application),
        now,
      );
    }
    const claimed = await this.transactions
      .updateOne(
        { _id: pending._id, consumed: false },
        { $set: { consumed: true } },
      )
      .session(db)
      .exec();
    if (
      claimed.modifiedCount !== 1 ||
      !validAuthority ||
      !user ||
      !application ||
      !grant
    ) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
    }
    if (proof) {
      await this.dpop.reserveProofId(db, proof.jti, now);
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
      undefined,
      undefined,
      proof?.thumbprint,
    );
  }

  private async recordProofRefusal(
    code: string,
    reason: string,
    now: Date,
  ): Promise<void> {
    const pending = await this.transactions
      .findOne({
        codeHash: hashToken(code),
        consumed: false,
        codeExpiresAt: { $gt: now },
      })
      .select({ clientId: 1, userId: 1 })
      .exec();
    if (!pending) {
      return;
    }
    await this.events.record({
      targetUserId: pending.userId?.toString(),
      clientId: pending.clientId,
      action: SECURITY_EVENT_ACTION.NATIVE_DPOP_PROOF_REFUSED,
      reasonCode: reason,
      outcome: SECURITY_EVENT_OUTCOME.FAILED,
    });
  }
}
