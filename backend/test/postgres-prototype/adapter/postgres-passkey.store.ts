import { Kysely } from 'kysely';
import {
  COUNTER_OUTCOME,
  CounterOutcome,
  NewPasskey,
  PASSKEY_CONSTRAINT,
  PasskeyDescriptor,
  PasskeyStore,
  StoredPasskey,
} from '../../../src/auth/passkeys/stores/passkey.store';
import {
  PasskeyAccount,
  PasskeyAccounts,
  StoredSignInMethods,
} from '../../../src/auth/passkeys/stores/passkey-accounts';
import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import { PrototypeDatabase } from './postgres-database';
import { toUuid } from './postgres-issuance-mappers';
import { autocommit } from './postgres-pending-codes-database';
import { postgresTransactionOf } from './postgres-unit-of-work';

/** Constraint names of the table to the rules' shared names. */
const PASSKEY_CONSTRAINTS: Readonly<Record<string, string>> = {
  passkey_credential_unique: PASSKEY_CONSTRAINT.CREDENTIAL_ID,
};

const PASSKEY_COLUMNS = [
  'id',
  'user_id',
  'credential_id',
  'public_key',
  'counter',
  'transports',
  'device_type',
  'backed_up',
  'name',
  'last_used_at',
  'created_at',
] as const;

interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  counter: string;
  transports: string[];
  device_type: string | null;
  backed_up: boolean;
  name: string;
  last_used_at: Date | null;
  created_at: Date;
}

function toStoredPasskey(row: PasskeyRow): StoredPasskey {
  return {
    id: row.id,
    userId: row.user_id,
    credentialId: row.credential_id,
    publicKey: row.public_key,
    counter: Number.parseInt(row.counter, 10),
    transports: row.transports,
    deviceType: row.device_type ?? undefined,
    backedUp: row.backed_up,
    name: row.name,
    lastUsedAt: row.last_used_at,
    createdAt: row.created_at,
  };
}

/**
 * One row per passkey, under a unique rule on the credential id. The counter
 * moves in one guarded statement: it counts as moved only while the stored
 * counter is the one the passkey was read with.
 */
export class PostgresPasskeyStore extends PasskeyStore {
  constructor(
    private readonly database: Kysely<PrototypeDatabase>,
    private readonly clock: { now(): Date },
  ) {
    super();
  }

  listDescriptors(userId: string): Promise<PasskeyDescriptor[]> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const rows = await this.database
        .selectFrom('passkeys')
        .select(['credential_id', 'transports'])
        .where('user_id', '=', toUuid(userId))
        .execute();
      return rows.map((row) => ({
        credentialId: row.credential_id,
        transports: row.transports,
      }));
    });
  }

  isCredentialRegistered(credentialId: string): Promise<boolean> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .selectFrom('passkeys')
        .select('id')
        .where('credential_id', '=', credentialId)
        .executeTakeFirst();
      return row !== undefined;
    });
  }

  insert(passkey: NewPasskey): Promise<StoredPasskey> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const at = this.clock.now();
      const row = await this.database
        .insertInto('passkeys')
        .values({
          user_id: toUuid(passkey.userId),
          credential_id: passkey.credentialId,
          public_key: passkey.publicKey,
          counter: passkey.counter,
          transports: passkey.transports,
          device_type: passkey.deviceType ?? null,
          backed_up: passkey.backedUp,
          // The MongoDB schema trims the name it stores.
          name: passkey.name.trim(),
          last_used_at: null,
          created_at: at,
          updated_at: at,
        })
        .returning(PASSKEY_COLUMNS)
        .executeTakeFirstOrThrow();
      return toStoredPasskey(row);
    });
  }

  findByCredentialId(credentialId: string): Promise<StoredPasskey | null> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .selectFrom('passkeys')
        .select(PASSKEY_COLUMNS)
        .where('credential_id', '=', credentialId)
        .executeTakeFirst();
      return row ? toStoredPasskey(row) : null;
    });
  }

  advanceCounter(
    passkey: StoredPasskey,
    use: { counter: number; usedAt: Date },
  ): Promise<CounterOutcome> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const moved = await this.database
        .updateTable('passkeys')
        .set({
          counter: use.counter,
          last_used_at: use.usedAt,
          updated_at: this.clock.now(),
        })
        .where('id', '=', toUuid(passkey.id))
        .where('counter', '=', String(passkey.counter))
        .executeTakeFirst();
      return moved.numUpdatedRows === 1n
        ? COUNTER_OUTCOME.ADVANCED
        : COUNTER_OUTCOME.ALREADY_ADVANCED;
    });
  }

  markUsed(passkey: StoredPasskey, usedAt: Date): Promise<void> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      await this.database
        .updateTable('passkeys')
        .set({ last_used_at: usedAt, updated_at: this.clock.now() })
        .where('id', '=', toUuid(passkey.id))
        .execute();
    });
  }

  listForAccount(userId: string): Promise<StoredPasskey[]> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const rows = await this.database
        .selectFrom('passkeys')
        .select(PASSKEY_COLUMNS)
        .where('user_id', '=', toUuid(userId))
        .orderBy('created_at', 'desc')
        .execute();
      return rows.map(toStoredPasskey);
    });
  }

  findOwned(userId: string, passkeyId: string): Promise<StoredPasskey | null> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .selectFrom('passkeys')
        .select(PASSKEY_COLUMNS)
        .where('id', '=', toUuid(passkeyId))
        .where('user_id', '=', toUuid(userId))
        .executeTakeFirst();
      return row ? toStoredPasskey(row) : null;
    });
  }

  rename(passkey: StoredPasskey, name: string): Promise<StoredPasskey> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .updateTable('passkeys')
        .set({ name: name.trim(), updated_at: this.clock.now() })
        .where('id', '=', toUuid(passkey.id))
        .returning(PASSKEY_COLUMNS)
        .executeTakeFirst();
      if (!row) {
        throw new Error('the passkey vanished while it was renamed');
      }
      return toStoredPasskey(row);
    });
  }

  async holdForAccount(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<number> {
    // Row locks on the passkeys counted, refused at once when another unit of
    // work holds one, so the count stays true until this one ends.
    const held = await postgresTransactionOf(unitOfWork)
      .selectFrom('passkeys')
      .select('id')
      .where('user_id', '=', toUuid(userId))
      .forUpdate()
      .noWait()
      .execute();
    return held.length;
  }

  async remove(unitOfWork: UnitOfWork, passkey: StoredPasskey): Promise<void> {
    await postgresTransactionOf(unitOfWork)
      .deleteFrom('passkeys')
      .where('id', '=', toUuid(passkey.id))
      .execute();
  }

  countForAccount(userId: string): Promise<number> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .selectFrom('passkeys')
        .select((select) => select.fn.countAll<string>().as('rows'))
        .where('user_id', '=', toUuid(userId))
        .executeTakeFirstOrThrow();
      return Number.parseInt(row.rows, 10);
    });
  }
}

/** The accounts passkeys belong to, read from the account tables. */
export class PostgresPasskeyAccounts extends PasskeyAccounts {
  constructor(private readonly database: Kysely<PrototypeDatabase>) {
    super();
  }

  findAccount(userId: string): Promise<PasskeyAccount | null> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .selectFrom('users')
        .select(['id', 'email', 'name', 'is_deleted'])
        .where('id', '=', toUuid(userId))
        .executeTakeFirst();
      return row
        ? {
            id: row.id,
            email: row.email ?? '',
            name: row.name ?? '',
            isDeleted: row.is_deleted,
          }
        : null;
    });
  }

  findSignInMethods(userId: string): Promise<StoredSignInMethods | null> {
    return autocommit(PASSKEY_CONSTRAINTS, async () => {
      const row = await this.database
        .selectFrom('users')
        .select((select) => [
          'users.password_hash',
          select
            .selectFrom('user_linked_accounts as link')
            .select((link) => link.fn.countAll<string>().as('links'))
            .whereRef('link.user_id', '=', 'users.id')
            .as('links'),
        ])
        .where('users.id', '=', toUuid(userId))
        .executeTakeFirst();
      return row
        ? {
            hasPassword: Boolean(row.password_hash),
            hasLinkedAccount: Number.parseInt(row.links ?? '0', 10) > 0,
          }
        : null;
    });
  }
}
