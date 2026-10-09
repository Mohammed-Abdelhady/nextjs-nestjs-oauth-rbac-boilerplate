import { CredentialPurpose } from '../constants/credential-purpose';
import {
  IssuanceAccount,
  IssuanceGrant,
  SessionDeviceLabel,
} from '../issuance/browser-issuance.store';
import { SessionAuthorityFields } from '../utils/authority/session-authority-rule';

export const IDLE_EXTENSION = {
  EXTENDED: 'extended',
  NOT_LIVE: 'not_live',
} as const;

export type IdleExtensionOutcome =
  (typeof IDLE_EXTENSION)[keyof typeof IDLE_EXTENSION];

/** A session as it is stored: what authority rests on, and what a list shows. */
export interface StoredSession extends SessionAuthorityFields {
  id: string;
  userId: string;
  userAgent: string;
  ip: string;
  device?: SessionDeviceLabel | null;
  deviceName?: string | null;
  lastUsedAt?: Date | null;
  proofKeyThumbprint?: string | null;
}

export type AuthorityAccount = IssuanceAccount;
export type AuthorityGrant = IssuanceGrant;

export interface SessionCandidateQuery {
  userId: string;
  userVersion: number;
  authEpoch: number;
  now: Date;
  purposes: CredentialPurpose[];
}

export interface IdleExtension {
  now: Date;
  idleExpiresAt: Date;
}

/**
 * What validating and listing sessions needs stored, and nothing about how.
 *
 * No method here takes a unit of work, and that is the point of the first
 * group. A committed authority read is fresh: it is answered by the primary
 * from what is committed when the read is made, and it never joins a snapshot
 * some unit of work opened earlier. A validation that starts after a
 * revocation has returned therefore sees it. Each call is its own read, so the
 * facts of one validation are each as fresh as the moment they were asked for.
 *
 * Ids are opaque strings. A string this database could not have issued is
 * refused with `MalformedIdError`.
 */
export abstract class SessionAuthorityStore {
  /** Committed authority read of the session a browser credential names. */
  abstract readCommittedSessionByTokenHash(
    tokenHash: string,
  ): Promise<StoredSession | null>;

  /** Committed authority read of one session. */
  abstract readCommittedSessionById(
    sessionId: string,
  ): Promise<StoredSession | null>;

  /** Committed authority read of the account's deletion mark and version. */
  abstract readCommittedAccount(
    userId: string,
  ): Promise<AuthorityAccount | null>;

  /** Committed authority read of the account's grant for one application. */
  abstract readCommittedGrant(
    userId: string,
    clientId: string,
  ): Promise<AuthorityGrant | null>;

  /** Committed authority read of the account's grants for some applications. */
  abstract readCommittedGrants(
    userId: string,
    clientIds: string[],
  ): Promise<AuthorityGrant[]>;

  /**
   * Sessions of the account stored as live at `now` for the given versions,
   * most recently used first. The caller decides which still hold authority.
   */
  abstract listSessionCandidates(
    query: SessionCandidateQuery,
  ): Promise<StoredSession[]>;

  /** The stored session, live or not. Not an authority read. */
  abstract findSessionById(sessionId: string): Promise<StoredSession | null>;

  /** The stored session, live or not. Not an authority read. */
  abstract findSessionByTokenHash(
    tokenHash: string,
  ): Promise<StoredSession | null>;

  /**
   * Moves the idle deadline and the activity times in one guarded write. Only a
   * session that is valid, unrevoked and inside both deadlines at `now` is
   * extended, so a session revoked since it was read is never revived.
   */
  abstract extendIdle(
    sessionId: string,
    extension: IdleExtension,
  ): Promise<IdleExtensionOutcome>;
}
