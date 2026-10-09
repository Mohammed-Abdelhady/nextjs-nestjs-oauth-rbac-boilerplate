import { HttpStatus } from '@nestjs/common';
import { ErrorCode } from '../../../src/common/enums/error-code.enum';
import { AppException } from '../../../src/common/exceptions/app.exception';
import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import { REVOKED_REASON } from '../../../src/session/constants/revoked-reason';
import { SECURITY_EVENT_ACTION } from '../../../src/session/constants/security-event-action';
import { newSecurityEvent } from '../../../src/session/events/security-event-recorder';
import { SecurityEventStore } from '../../../src/session/events/security-event.store';
import {
  AccountSessions,
  SessionRevocationReason,
} from '../../../src/user/stores/account-sessions';
import { toUuid } from './postgres-issuance-mappers';
import { postgresTransactionOf } from './postgres-unit-of-work';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A stand-in for the session service, which is not on this database yet. It
 * applies the service's rules as they are today: sessions end because the
 * account's version moves past the one they carry, and the kept session is
 * moved along with it. The account is taken first, with the lock sign-in takes.
 * The event is appended through the one event store, in the caller's unit of
 * work.
 */
export class PostgresAccountSessions extends AccountSessions {
  constructor(
    private readonly clock: { now(): Date },
    private readonly events: SecurityEventStore,
  ) {
    super();
  }

  async revokeAll(
    unitOfWork: UnitOfWork,
    userId: string,
    reason?: SessionRevocationReason,
  ): Promise<number> {
    const version = await this.takeVersion(unitOfWork, userId);
    if (version === null) {
      return 0;
    }
    const work = postgresTransactionOf(unitOfWork);
    const live = await this.countLive(unitOfWork, userId, version);
    await work
      .updateTable('users')
      .set((column) => ({
        session_version: column('session_version', '+', 1),
      }))
      .where('id', '=', toUuid(userId))
      .execute();
    await this.events.append(
      unitOfWork,
      newSecurityEvent(
        {
          actorId: reason?.actorId,
          targetUserId: userId,
          action: SECURITY_EVENT_ACTION.SESSIONS_REVOKED_ALL,
          reasonCode: reason?.reasonCode ?? REVOKED_REASON.ALL_USER,
          roleAssignment: reason?.roleAssignment,
        },
        this.clock.now(),
      ),
    );
    return live;
  }

  async revokeAllExcept(
    unitOfWork: UnitOfWork,
    userId: string,
    keptSessionId: string,
  ): Promise<number> {
    const version = await this.takeVersion(unitOfWork, userId);
    if (version === null) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }
    if (!UUID_PATTERN.test(keptSessionId)) {
      throw sessionInvalid();
    }
    const work = postgresTransactionOf(unitOfWork);
    const live = await this.countLive(unitOfWork, userId, version);
    await work
      .updateTable('users')
      .set({ session_version: version + 1 })
      .where('id', '=', toUuid(userId))
      .execute();
    const promoted = await work
      .updateTable('sessions')
      .set({ user_version: version + 1 })
      .where('id', '=', keptSessionId)
      .where('user_id', '=', toUuid(userId))
      .where('is_valid', '=', true)
      .where('revoked_at', 'is', null)
      .where('user_version', '=', version)
      .returning('id')
      .execute();
    if (promoted.length !== 1) {
      throw sessionInvalid();
    }
    await this.events.append(
      unitOfWork,
      newSecurityEvent(
        {
          targetUserId: userId,
          sessionId: keptSessionId,
          action: SECURITY_EVENT_ACTION.SESSIONS_REVOKED_OTHERS,
          reasonCode: REVOKED_REASON.ALL_OTHER,
        },
        this.clock.now(),
      ),
    );
    return Math.max(0, live - 1);
  }

  /** The account's session version, with the account taken for this work. */
  private async takeVersion(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<number | null> {
    const row = await postgresTransactionOf(unitOfWork)
      .selectFrom('users')
      .select('session_version')
      .where('id', '=', toUuid(userId))
      .forNoKeyUpdate()
      .noWait()
      .executeTakeFirst();
    return row ? row.session_version : null;
  }

  private async countLive(
    unitOfWork: UnitOfWork,
    userId: string,
    version: number,
  ): Promise<number> {
    const now = this.clock.now();
    const counted = await postgresTransactionOf(unitOfWork)
      .selectFrom('sessions')
      .select((session) => session.fn.countAll<string>().as('total'))
      .where('user_id', '=', toUuid(userId))
      .where('is_valid', '=', true)
      .where('revoked_at', 'is', null)
      .where('expires_at', '>', now)
      .where('idle_expires_at', '>', now)
      .where('user_version', '=', version)
      .executeTakeFirstOrThrow();
    return Number.parseInt(counted.total, 10);
  }
}

function sessionInvalid(): AppException {
  return new AppException(
    ErrorCode.SESSION_INVALID,
    'Current session is no longer active',
    HttpStatus.UNAUTHORIZED,
  );
}
