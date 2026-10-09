import { Injectable } from '@nestjs/common';
import { SessionService } from '../../../auth/services/sessions/session.service';
import { UnitOfWork } from '../../../common/persistence/unit-of-work';
import { toObjectId } from '../../../session/persistence/mongo/mongo-issuance-mappers';
import { mongoSessionOf } from '../../../session/persistence/mongo/mongo-unit-of-work';
import {
  AccountSessions,
  SessionRevocationReason,
} from '../../stores/account-sessions';

/**
 * Hands the revocation to the session service, which still owns it on
 * MongoDB. It goes away when revocation moves behind its own store.
 */
@Injectable()
export class MongoAccountSessions extends AccountSessions {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  revokeAll(
    unitOfWork: UnitOfWork,
    userId: string,
    reason?: SessionRevocationReason,
  ): Promise<number> {
    const session = mongoSessionOf(unitOfWork);
    const id = toObjectId(userId);
    return reason
      ? this.sessionService.invalidateAllSessions(id, session, reason)
      : this.sessionService.invalidateAllSessions(id, session);
  }

  revokeAllExcept(
    unitOfWork: UnitOfWork,
    userId: string,
    keptSessionId: string,
  ): Promise<number> {
    return this.sessionService.invalidateAllSessionsExceptSession(
      toObjectId(userId),
      keptSessionId,
      mongoSessionOf(unitOfWork),
    );
  }
}
