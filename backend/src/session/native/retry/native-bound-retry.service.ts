import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { SECURITY_EVENT_ACTION } from '../../constants/security-event-action';
import { CREDENTIAL_PURPOSE } from '../../constants/credential-purpose';
import {
  NATIVE_DPOP_FAILURE_REASON,
  NATIVE_DPOP_RETRY_WINDOW_MS,
} from '../../constants/session-policy';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../../schemas/native-credential.schema';
import { SessionDocument } from '../../schemas/session.schema';
import { SecurityEventService } from '../../services/security-event.service';
import { UserDocument } from '../../../user/schemas/user.schema';
import { ApplicationDocument } from '../../schemas/application.schema';
import { UserApplicationGrantDocument } from '../../schemas/user-application-grant.schema';
import { hashToken } from '../../utils/hashing/token-hash';
import { NativeCredentialIssuer } from '../token/native-credential.issuer';
import {
  ClientMeta,
  OAUTH_ERROR,
  OauthFailure,
  TokenSuccess,
  oauthFailure,
} from '../oauth/native-oauth.types';
import type { NativeDpopProofResult } from '../proof/native-dpop-proof';

export interface NativeBoundRetryInput {
  db: ClientSession;
  presented: NativeCredentialDocument;
  session: SessionDocument;
  user: UserDocument;
  application: ApplicationDocument;
  grant: UserApplicationGrantDocument;
  meta: ClientMeta;
  now: Date;
  thumbprint: string;
  proof: Extract<NativeDpopProofResult, { ok: true }>;
}

@Injectable()
export class NativeBoundRetryService {
  constructor(
    @InjectModel(NativeCredential.name)
    private readonly credentials: Model<NativeCredentialDocument>,
    private readonly issuer: NativeCredentialIssuer,
    private readonly events: SecurityEventService,
  ) {}

  async retryOrReplay(
    input: NativeBoundRetryInput,
  ): Promise<TokenSuccess | OauthFailure> {
    const { presented, now } = input;
    if (!this.insideRetryWindow(presented, now)) {
      return this.replay(input);
    }
    const successor = await this.findUnusedSuccessor(input);
    if (!successor) {
      return this.replay(input);
    }
    const claimed = await this.credentials
      .updateOne(
        {
          _id: presented._id,
          spent: true,
          revokedAt: { $exists: false },
          $or: [
            { retryClaimUntil: { $exists: false } },
            { retryClaimUntil: { $lte: now } },
          ],
        },
        {
          $set: {
            retryClaimUntil: new Date(
              now.getTime() + NATIVE_DPOP_RETRY_WINDOW_MS,
            ),
          },
        },
      )
      .session(input.db)
      .exec();
    if (claimed.modifiedCount !== 1) {
      return oauthFailure(
        HttpStatus.BAD_REQUEST,
        OAUTH_ERROR.INVALID_DPOP_PROOF,
        NATIVE_DPOP_FAILURE_REASON.RETRY_IN_PROGRESS,
      );
    }
    const pairRevoked = await this.revokeUnusedSuccessor(input, successor);
    if (!pairRevoked) {
      return this.replay(input);
    }
    const replacement = await this.issuer.issuePair(
      input.db,
      input.user,
      input.application,
      input.grant,
      {
        clientId: input.presented.clientId,
        requestedScopes: input.session.scopes,
        audience: input.session.audience,
        authenticationMethods: input.session.authenticationMethods,
      },
      input.meta,
      input.now,
      successor.refresh.generation,
      input.session,
      input.presented.familyId,
      input.thumbprint,
    );
    const linked = await this.credentials
      .updateOne(
        { _id: input.presented._id, retryClaimUntil: { $gt: input.now } },
        {
          $set: {
            successorAccessHash: hashToken(replacement.accessToken),
            successorRefreshHash: hashToken(replacement.refreshToken),
          },
        },
      )
      .session(input.db)
      .exec();
    if (linked.modifiedCount !== 1) {
      return this.replay(input);
    }
    await this.events.record(
      {
        targetUserId: input.user._id.toString(),
        clientId: input.presented.clientId,
        sessionId: input.session._id.toString(),
        action: SECURITY_EVENT_ACTION.NATIVE_DPOP_BOUND_RETRY,
      },
      input.db,
    );
    return replacement;
  }

  private insideRetryWindow(
    presented: NativeCredentialDocument,
    now: Date,
  ): boolean {
    const consumedAt = presented.consumedAt?.getTime();
    return (
      presented.expiresAt.getTime() > now.getTime() &&
      consumedAt !== undefined &&
      consumedAt <= now.getTime() &&
      now.getTime() - consumedAt < NATIVE_DPOP_RETRY_WINDOW_MS
    );
  }

  private async findUnusedSuccessor(input: NativeBoundRetryInput): Promise<
    | {
        access: NativeCredentialDocument;
        refresh: NativeCredentialDocument;
      }
    | undefined
  > {
    const { presented, db } = input;
    if (!presented.successorAccessHash || !presented.successorRefreshHash) {
      return undefined;
    }
    const refresh = await this.credentials
      .findOne({
        tokenHash: presented.successorRefreshHash,
        purpose: CREDENTIAL_PURPOSE.NATIVE_REFRESH,
        familyId: presented.familyId,
        sessionId: presented.sessionId,
        clientId: presented.clientId,
        generation: presented.generation + 1,
        spent: false,
        revokedAt: { $exists: false },
      })
      .session(db)
      .exec();
    if (!refresh) {
      return undefined;
    }
    const access = await this.credentials
      .findOne({
        tokenHash: presented.successorAccessHash,
        purpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS,
        familyId: presented.familyId,
        sessionId: presented.sessionId,
        clientId: presented.clientId,
        generation: refresh.generation,
        firstUsedAt: { $exists: false },
        spent: false,
        revokedAt: { $exists: false },
      })
      .session(db)
      .exec();
    if (!access) {
      return undefined;
    }
    const usedGeneration = await this.credentials
      .findOne({
        familyId: presented.familyId,
        sessionId: presented.sessionId,
        generation: refresh.generation,
        purpose: CREDENTIAL_PURPOSE.NATIVE_ACCESS,
        firstUsedAt: { $exists: true },
      })
      .session(db)
      .exec();
    return usedGeneration ? undefined : { access, refresh };
  }

  private async revokeUnusedSuccessor(
    input: NativeBoundRetryInput,
    successor: {
      access: NativeCredentialDocument;
      refresh: NativeCredentialDocument;
    },
  ): Promise<boolean> {
    const refresh = await this.credentials
      .updateOne(
        {
          _id: successor.refresh._id,
          spent: false,
          revokedAt: { $exists: false },
        },
        { $set: { spent: true, revokedAt: input.now } },
      )
      .session(input.db)
      .exec();
    const access = await this.credentials
      .updateOne(
        {
          _id: successor.access._id,
          spent: false,
          revokedAt: { $exists: false },
          firstUsedAt: { $exists: false },
        },
        { $set: { spent: true, revokedAt: input.now } },
      )
      .session(input.db)
      .exec();
    return refresh.modifiedCount === 1 && access.modifiedCount === 1;
  }

  private async replay(input: NativeBoundRetryInput): Promise<OauthFailure> {
    await this.issuer.revokeFamily(
      input.db,
      input.presented.familyId,
      input.presented.sessionId,
      input.now,
      SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
    );
    return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
  }
}
