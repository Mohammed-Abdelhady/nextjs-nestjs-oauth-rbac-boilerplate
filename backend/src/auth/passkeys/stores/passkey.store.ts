import { UnitOfWork } from '../../../common/persistence/unit-of-work';

/** Shared names of the unique rules a passkey can run into. */
export const PASSKEY_CONSTRAINT = {
  CREDENTIAL_ID: 'passkey.credential_id',
} as const;

export const COUNTER_OUTCOME = {
  ADVANCED: 'advanced',
  ALREADY_ADVANCED: 'already_advanced',
} as const;

/**
 * How moving a signature counter ended: this call moved it, or the stored
 * counter was no longer the one the passkey was read with.
 */
export type CounterOutcome =
  (typeof COUNTER_OUTCOME)[keyof typeof COUNTER_OUTCOME];

/** One WebAuthn credential. A write takes the record back. */
export interface StoredPasskey {
  readonly id: string;
  readonly userId: string;
  /** Credential id as base64url. */
  readonly credentialId: string;
  /** COSE public key exactly as the authenticator produced it. */
  readonly publicKey: Buffer;
  /** Signature count last reported. Zero for authenticators that do not count. */
  readonly counter: number;
  readonly transports: string[];
  readonly deviceType?: string;
  readonly backedUp: boolean;
  readonly name: string;
  readonly lastUsedAt: Date | null;
  readonly createdAt: Date;
}

export interface NewPasskey {
  userId: string;
  credentialId: string;
  publicKey: Buffer;
  counter: number;
  transports: string[];
  deviceType?: string;
  backedUp: boolean;
  name: string;
}

/** What an authenticator is told to leave out when it registers. */
export interface PasskeyDescriptor {
  credentialId: string;
  transports: string[];
}

/**
 * The credentials registered to accounts. A credential id belongs to one
 * passkey, and every read of an account's passkeys is scoped to that account.
 */
export abstract class PasskeyStore {
  /** The credentials already on the account. */
  abstract listDescriptors(userId: string): Promise<PasskeyDescriptor[]>;
  abstract isCredentialRegistered(credentialId: string): Promise<boolean>;
  /**
   * Stores a passkey that was never used. A credential id that is already
   * stored is a `UniqueConflictError` named `passkey.credential_id`.
   */
  abstract insert(passkey: NewPasskey): Promise<StoredPasskey>;

  abstract findByCredentialId(
    credentialId: string,
  ): Promise<StoredPasskey | null>;
  /**
   * Stores the new counter and the time of use, only while the stored counter
   * is still the one this record was read with. Of two assertions that read
   * the same counter, one advances it.
   */
  abstract advanceCounter(
    passkey: StoredPasskey,
    use: { counter: number; usedAt: Date },
  ): Promise<CounterOutcome>;
  /** Stores the time of use for a passkey whose authenticator does not count. */
  abstract markUsed(passkey: StoredPasskey, usedAt: Date): Promise<void>;

  /** The account's passkeys, newest first. */
  abstract listForAccount(userId: string): Promise<StoredPasskey[]>;
  /** The passkey with this id, only when it is on this account. */
  abstract findOwned(
    userId: string,
    passkeyId: string,
  ): Promise<StoredPasskey | null>;
  abstract rename(passkey: StoredPasskey, name: string): Promise<StoredPasskey>;
  /**
   * Counts the account's passkeys and holds them until the unit of work ends.
   * No other unit of work can hold or remove one of them meanwhile: a second
   * one that tries is refused at once with a retryable abort, runs again, and
   * counts what is left then.
   */
  abstract holdForAccount(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<number>;
  /** Removes a passkey of an account whose passkeys the unit of work holds. */
  abstract remove(
    unitOfWork: UnitOfWork,
    passkey: StoredPasskey,
  ): Promise<void>;
  abstract countForAccount(userId: string): Promise<number>;
}
