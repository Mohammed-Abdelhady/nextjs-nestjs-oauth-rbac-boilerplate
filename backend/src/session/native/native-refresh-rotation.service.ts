import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { UserDocument } from '../../user/schemas/user.schema';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import { ApplicationDocument } from '../schemas/application.schema';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { SessionDocument } from '../schemas/session.schema';
import { UserApplicationGrantDocument } from '../schemas/user-application-grant.schema';
import { hashToken } from '../utils/token-hash';
import { NativeCredentialIssuer } from './native-credential.issuer';
import {
  ClientMeta,
  OAUTH_ERROR,
  OauthFailure,
  TokenSuccess,
  oauthFailure,
} from './native-oauth.types';

export interface RefreshAuthority {
  session: SessionDocument;
  user: UserDocument;
  application: ApplicationDocument;
  grant: UserApplicationGrantDocument;
}

@Injectable()
export class NativeRefreshRotationService {
  constructor(
    @InjectModel(NativeCredential.name)
    private readonly credentials: Model<NativeCredentialDocument>,
    private readonly issuer: NativeCredentialIssuer,
  ) {}

  async claimAndRotate(
    db: ClientSession,
    presented: NativeCredentialDocument,
    authority: RefreshAuthority,
    meta: ClientMeta,
    now: Date,
    thumbprint?: string,
  ): Promise<TokenSuccess | OauthFailure> {
    const claimed = await this.credentials
      .updateOne(
        { _id: presented._id, spent: false },
        { $set: { spent: true, consumedAt: now } },
      )
      .session(db)
      .exec();
    if (claimed.modifiedCount !== 1) {
      return this.replay(db, presented, now);
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
    const pair = await this.issuer.issuePair(
      db,
      authority.user,
      authority.application,
      authority.grant,
      {
        clientId: presented.clientId,
        requestedScopes: authority.session.scopes,
        audience: authority.session.audience,
        authenticationMethods: authority.session.authenticationMethods,
      },
      meta,
      now,
      presented.generation + 1,
      authority.session,
      presented.familyId,
      thumbprint,
    );
    if (thumbprint) {
      const linked = await this.credentials
        .updateOne(
          { _id: presented._id, spent: true },
          {
            $set: {
              successorAccessHash: hashToken(pair.accessToken),
              successorRefreshHash: hashToken(pair.refreshToken),
            },
          },
        )
        .session(db)
        .exec();
      if (linked.modifiedCount !== 1) {
        return this.replay(db, presented, now);
      }
    }
    return pair;
  }

  async replay(
    db: ClientSession,
    presented: NativeCredentialDocument,
    now: Date,
  ): Promise<OauthFailure> {
    await this.issuer.revokeFamily(
      db,
      presented.familyId,
      presented.sessionId,
      now,
      SECURITY_EVENT_ACTION.REFRESH_REPLAYED,
    );
    return oauthFailure(HttpStatus.BAD_REQUEST, OAUTH_ERROR.INVALID_GRANT);
  }
}
