import { FilterQuery, Types } from 'mongoose';
import { AUTH_SCHEMA_VERSION } from '../constants/session-policy';
import {
  CREDENTIAL_PURPOSE,
  CredentialPurpose,
} from '../constants/credential-purpose';
import { Application } from '../schemas/application.schema';
import { Session } from '../schemas/session.schema';
import { UserApplicationGrant } from '../schemas/user-application-grant.schema';
import { User } from '../../user/schemas/user.schema';
import { addMs, effectiveDeadline, isDeadlinePassed } from './session-deadline';

type SessionAuthorityFields = Pick<
  Session,
  | 'isValid'
  | 'revokedAt'
  | 'credentialPurpose'
  | 'authEpoch'
  | 'schemaVersion'
  | 'clientId'
  | 'userVersion'
  | 'clientVersion'
  | 'grantVersion'
  | 'authenticatedAt'
  | 'expiresAt'
  | 'idleExpiresAt'
  | 'lastActivityAt'
>;

export interface EffectiveSessionDeadlines {
  absolute: Date;
  idle: Date;
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

export function currentSessionCandidateFilter(
  userId: Types.ObjectId,
  now: Date,
  userVersion: number,
  authEpoch: number,
): FilterQuery<Session> {
  return {
    user: userId,
    isValid: true,
    revokedAt: null,
    expiresAt: { $gt: now, $type: 'date' },
    idleExpiresAt: { $gt: now, $type: 'date' },
    authenticatedAt: { $type: 'date' },
    lastActivityAt: { $type: 'date' },
    clientId: { $type: 'string', $ne: '' },
    clientVersion: { $type: 'number' },
    grantVersion: { $type: 'number' },
    credentialPurpose: CREDENTIAL_PURPOSE.BROWSER_SESSION,
    authEpoch,
    schemaVersion: AUTH_SCHEMA_VERSION,
    userVersion,
  };
}

export function currentSessionDeadlines(
  session: SessionAuthorityFields,
  user: Pick<User, 'isDeleted' | 'sessionVersion'> | null | undefined,
  application:
    | Pick<Application, 'enabled' | 'sessionVersion' | 'policy'>
    | null
    | undefined,
  grant:
    Pick<UserApplicationGrant, 'allowed' | 'sessionVersion'> | null | undefined,
  now: Date,
  authEpoch: number,
  purpose: CredentialPurpose,
): EffectiveSessionDeadlines | null {
  if (
    !session.clientId ||
    !isValidDate(session.authenticatedAt) ||
    !isValidDate(session.expiresAt) ||
    !isValidDate(session.idleExpiresAt) ||
    !isValidDate(session.lastActivityAt) ||
    typeof session.userVersion !== 'number' ||
    typeof session.clientVersion !== 'number' ||
    typeof session.grantVersion !== 'number' ||
    typeof session.authEpoch !== 'number' ||
    typeof session.schemaVersion !== 'number'
  ) {
    return null;
  }

  if (
    !session.isValid ||
    session.revokedAt ||
    session.credentialPurpose !== purpose ||
    session.authEpoch !== authEpoch ||
    session.schemaVersion !== AUTH_SCHEMA_VERSION ||
    !user ||
    user.isDeleted ||
    session.userVersion !== (user.sessionVersion ?? 0) ||
    !application ||
    !application.enabled ||
    session.clientVersion !== (application.sessionVersion ?? 0) ||
    !grant ||
    !grant.allowed ||
    session.grantVersion !== (grant.sessionVersion ?? 0)
  ) {
    return null;
  }

  const absolute = effectiveDeadline(
    session.expiresAt,
    addMs(session.authenticatedAt, application.policy.absoluteLifetimeMs),
  );
  const idle = effectiveDeadline(
    session.idleExpiresAt,
    addMs(session.lastActivityAt, application.policy.idleLifetimeMs),
  );
  if (isDeadlinePassed(now, absolute) || isDeadlinePassed(now, idle)) {
    return null;
  }
  return { absolute, idle };
}
