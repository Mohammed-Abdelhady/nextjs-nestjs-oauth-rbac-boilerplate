import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { Clock } from '../../common/services/clock';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { APPLICATION_PLATFORM } from '../constants/client-ids';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import {
  NATIVE_DPOP_FAILURE_REASON,
  NATIVE_DPOP_TOKEN_PATH,
} from '../constants/session-policy';
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
import { currentSessionDeadlines } from '../utils/current-session-authority';
import { hashToken } from '../utils/token-hash';
import { withMajorityTransaction } from '../utils/mongo-transaction';
import { resolveNativeBoundThumbprint } from './native-bound-thumbprint';
import { NativeBoundRetryService } from './native-bound-retry.service';
import {
  BoundProofEventContext,
  NativeBoundProofService,
} from './native-bound-proof.service';
import {
  NativeRefreshRotationService,
  RefreshAuthority,
} from './native-refresh-rotation.service';
import { nativeDpopOauthFailure } from './native-dpop-oauth';
import { isNativeDpopProofIdConflict } from './native-dpop.service';
import {
  ClientMeta,
  OAUTH_ERROR,
  OauthFailure,
  TokenSuccess,
  oauthFailure,
} from './native-oauth.types';

type ProofEventContext = BoundProofEventContext;

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
    private readonly rotation: NativeRefreshRotationService,
    private readonly retries: NativeBoundRetryService,
    private readonly boundProofs: NativeBoundProofService,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async rotate(
    refreshToken: string,
    clientId: string,
    meta: ClientMeta,
    dpopProof?: string,
  ): Promise<TokenSuccess | OauthFailure> {
    const presentedToken = refreshToken.trim();
    const presentedClient = clientId.trim();
    if (!presentedToken || !presentedClient) {
      return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_REQUEST);
    }
    const now = this.clock.now();
    let refusalContext: ProofEventContext | undefined;
    try {
      return await withMajorityTransaction(this.connection, async (db) => {
        const presented = await this.credentials
          .findOne({ tokenHash: hashToken(presentedToken) })
          .session(db)
          .exec();
        if (
          !presented ||
          presented.purpose !== CREDENTIAL_PURPOSE.NATIVE_REFRESH ||
          presented.clientId !== presentedClient ||
          presented.revokedAt
        ) {
          return this.invalidGrant();
        }
        const session = await this.sessions
          .findById(presented.sessionId)
          .session(db)
          .exec();
        const binding = resolveNativeBoundThumbprint(
          session?.proofKeyThumbprint,
          presented.proofKeyThumbprint,
        );
        if (binding.inconsistent) {
          refusalContext = this.proofEventContext(presented, session);
          await this.boundProofs.recordRefusal(
            db,
            refusalContext,
            NATIVE_DPOP_FAILURE_REASON.CONFIGURATION_INVALID,
          );
          return oauthFailure(
            HttpStatus.BAD_REQUEST,
            OAUTH_ERROR.INVALID_DPOP_PROOF,
            NATIVE_DPOP_FAILURE_REASON.CONFIGURATION_INVALID,
          );
        }
        if (!binding.thumbprint) {
          if (this.authEpoch.nativeDpopRequired()) {
            return oauthFailure(
              HttpStatus.BAD_REQUEST,
              OAUTH_ERROR.INVALID_DPOP_PROOF,
              NATIVE_DPOP_FAILURE_REASON.REQUIRED,
            );
          }
          return this.rotateUnbound(
            db,
            presented,
            session,
            presentedClient,
            meta,
            now,
          );
        }
        return this.rotateBound(
          db,
          presented,
          session,
          presentedToken,
          presentedClient,
          meta,
          dpopProof,
          binding.thumbprint,
          now,
          (context) => {
            refusalContext = context;
          },
        );
      });
    } catch (error) {
      if (isNativeDpopProofIdConflict(error) && refusalContext) {
        await this.boundProofs.recordRefusal(
          undefined,
          refusalContext,
          NATIVE_DPOP_FAILURE_REASON.PROOF_REPLAYED,
        );
        return oauthFailure(
          HttpStatus.BAD_REQUEST,
          OAUTH_ERROR.INVALID_DPOP_PROOF,
          NATIVE_DPOP_FAILURE_REASON.PROOF_REPLAYED,
        );
      }
      throw error;
    }
  }

  private async rotateBound(
    db: ClientSession,
    presented: NativeCredentialDocument,
    session: SessionDocument | null,
    token: string,
    clientId: string,
    meta: ClientMeta,
    dpopProof: string | undefined,
    thumbprint: string,
    now: Date,
    setRefusalContext: (context: ProofEventContext) => void,
  ): Promise<TokenSuccess | OauthFailure> {
    const verification = this.boundProofs.verify(
      dpopProof,
      token,
      thumbprint,
      NATIVE_DPOP_TOKEN_PATH,
      now,
    );
    if (!verification.result.ok) {
      const context = this.proofEventContext(presented, session);
      setRefusalContext(context);
      await this.boundProofs.recordRefusal(
        db,
        context,
        verification.result.reason,
      );
      return nativeDpopOauthFailure(
        verification.result,
        verification.challengeNonce,
      );
    }
    setRefusalContext(this.proofEventContext(presented, session));
    const authority = await this.loadAuthority(db, clientId, session, now);
    if (!authority) {
      if (presented.spent) {
        return this.rotation.replay(db, presented, now);
      }
      return this.invalidGrant();
    }
    if (presented.spent) {
      await this.boundProofs.reserve(db, verification.result.jti, now);
      return this.retries.retryOrReplay({
        db,
        presented,
        ...authority,
        meta,
        now,
        thumbprint,
        proof: verification.result,
      });
    }
    if (presented.expiresAt.getTime() <= now.getTime()) {
      return this.invalidGrant();
    }
    await this.boundProofs.reserve(db, verification.result.jti, now);
    if (!authority.session.proofKeyThumbprint) {
      await this.sessions
        .updateOne(
          {
            _id: authority.session._id,
            proofKeyThumbprint: { $exists: false },
          },
          { $set: { proofKeyThumbprint: thumbprint } },
        )
        .session(db)
        .exec();
    }
    return this.rotation.claimAndRotate(
      db,
      presented,
      authority,
      meta,
      now,
      thumbprint,
    );
  }

  private async rotateUnbound(
    db: ClientSession,
    presented: NativeCredentialDocument,
    session: SessionDocument | null,
    clientId: string,
    meta: ClientMeta,
    now: Date,
  ): Promise<TokenSuccess | OauthFailure> {
    if (presented.spent) {
      return this.rotation.replay(db, presented, now);
    }
    if (presented.expiresAt.getTime() <= now.getTime()) {
      return this.invalidGrant();
    }
    const authority = await this.loadAuthority(db, clientId, session, now);
    if (!authority) {
      return this.invalidGrant();
    }
    return this.rotation.claimAndRotate(db, presented, authority, meta, now);
  }

  private async loadAuthority(
    db: ClientSession,
    clientId: string,
    session: SessionDocument | null,
    now: Date,
  ): Promise<RefreshAuthority | undefined> {
    if (!session || session.clientId !== clientId) {
      return undefined;
    }
    const user = await this.users.findById(session.user).session(db).exec();
    const application = await this.applications
      .findOne({ clientId, environment: this.authEpoch.environment() })
      .session(db)
      .exec();
    const grant = user
      ? await this.grants
          .findOne({ userId: user._id, clientId })
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
      return undefined;
    }
    return { session, user, application, grant };
  }

  private proofEventContext(
    presented: NativeCredentialDocument,
    session: SessionDocument | null,
  ): ProofEventContext {
    return {
      ...(session ? { targetUserId: session.user.toString() } : {}),
      sessionId: presented.sessionId.toString(),
      clientId: presented.clientId,
    };
  }

  private invalidGrant(): OauthFailure {
    return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
  }
}
