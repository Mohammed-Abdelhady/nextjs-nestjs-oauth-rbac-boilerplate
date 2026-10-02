import { Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Clock } from '../../common/services/clock';
import { CREDENTIAL_PURPOSE } from '../constants/credential-purpose';
import { REVOKED_REASON } from '../constants/revoked-reason';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import {
  NativeCredential,
  NativeCredentialDocument,
} from '../schemas/native-credential.schema';
import { Session, SessionDocument } from '../schemas/session.schema';
import { asAuthorityUnavailable } from '../utils/authority-unavailable';
import { withMajorityTransaction } from '../utils/mongo-transaction';
import { SecurityEventService } from './security-event.service';

/**
 * Signs a native caller out: revokes its session and the whole token family
 * issued for it, so neither the access nor the refresh token works again.
 */
@Injectable()
export class NativeSessionRevocationService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Session.name)
    private readonly sessionModel: Model<SessionDocument>,
    @InjectModel(NativeCredential.name)
    private readonly credentialModel: Model<NativeCredentialDocument>,
    private readonly events: SecurityEventService,
    private readonly clock: Clock,
  ) {}

  async revokeNativeSession(
    sessionId: string,
    userId: Types.ObjectId,
  ): Promise<boolean> {
    try {
      const revoked = await withMajorityTransaction(
        this.connection,
        async (session) => {
          if (!Types.ObjectId.isValid(sessionId)) {
            return 0;
          }
          const existing = await this.sessionModel
            .findOne({ _id: sessionId, user: userId })
            .session(session)
            .exec();
          if (
            !existing ||
            !existing.isValid ||
            existing.revokedAt ||
            existing.credentialPurpose !== CREDENTIAL_PURPOSE.NATIVE_ACCESS
          ) {
            return 0;
          }
          const now = this.clock.now();
          const revokedSession = await this.sessionModel
            .updateOne(
              {
                _id: existing._id,
                isValid: true,
                revokedAt: { $exists: false },
              },
              {
                $set: {
                  isValid: false,
                  revokedAt: now,
                  revokedReason: REVOKED_REASON.CURRENT,
                },
              },
            )
            .session(session)
            .exec();
          if (revokedSession.modifiedCount !== 1) {
            return 0;
          }
          await this.credentialModel
            .updateMany(
              { sessionId: existing._id },
              { $set: { spent: true, revokedAt: now } },
            )
            .session(session)
            .exec();
          await this.events.record(
            {
              targetUserId: userId.toString(),
              clientId: existing.clientId,
              sessionId: existing._id.toString(),
              action: SECURITY_EVENT_ACTION.SESSION_REVOKED,
              reasonCode: REVOKED_REASON.CURRENT,
            },
            session,
          );
          return 1;
        },
      );
      return revoked > 0;
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }
}
