import { randomUUID } from 'crypto';
import { Kysely } from 'kysely';
import {
  ActivatedAccount,
  ActivationAccounts,
  ActivationSignIn,
  ActivationSignInOutcome,
  AddressConfirmation,
  AddressOwner,
  MovedAccount,
  NewActivatedAccount,
} from '../../../src/auth/pending-codes/activation-accounts';
import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import { AuthProvider } from '../../../src/user/enums/auth-provider.enum';
import { accountFailure, accountStatement } from './postgres-account-rows';
import { PrototypeDatabase } from './postgres-database';
import { toUuid } from './postgres-issuance-mappers';
import { storedAddress } from './postgres-pending-codes-database';
import { postgresTransactionOf } from './postgres-unit-of-work';

class PostgresActivatedAccount extends ActivatedAccount {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly name: string,
    readonly role: string,
  ) {
    super();
  }
}

class PostgresMovedAccount extends MovedAccount {
  constructor(
    readonly id: string,
    readonly email: string,
    readonly addressGeneration: number,
  ) {
    super();
  }
}

export class PostgresActivationAccounts extends ActivationAccounts {
  constructor(
    private readonly database: Kysely<PrototypeDatabase>,
    private readonly clock: { now(): Date },
  ) {
    super();
  }

  newAccountId(): string {
    return randomUUID();
  }

  findAddressOwner(email: string): Promise<AddressOwner | null> {
    return accountStatement(async () => {
      const row = await this.database
        .selectFrom('users')
        .select(['name', 'is_deleted'])
        .where('email', '=', storedAddress(email))
        .executeTakeFirst();
      return row ? { name: row.name ?? '', isDeleted: row.is_deleted } : null;
    });
  }

  isStored(accountId: string): Promise<boolean> {
    return accountStatement(async () => {
      const row = await this.database
        .selectFrom('users')
        .select('id')
        .where('id', '=', toUuid(accountId))
        .executeTakeFirst();
      return row !== undefined;
    });
  }

  findAddressConfirmation(userId: string): Promise<AddressConfirmation | null> {
    return accountStatement(async () => {
      const row = await this.database
        .selectFrom('users')
        .select(['is_verified', 'address_generation'])
        .where('id', '=', toUuid(userId))
        .executeTakeFirst();
      return row
        ? {
            isVerified: row.is_verified,
            addressGeneration: row.address_generation,
          }
        : null;
    });
  }

  async hasActiveAccount(
    unitOfWork: UnitOfWork,
    email: string,
  ): Promise<boolean> {
    const row = await postgresTransactionOf(unitOfWork)
      .selectFrom('users')
      .select('id')
      .where('email', '=', storedAddress(email))
      .where('is_deleted', '=', false)
      .executeTakeFirst();
    return row !== undefined;
  }

  async insertActivated(
    unitOfWork: UnitOfWork,
    account: NewActivatedAccount,
  ): Promise<ActivatedAccount> {
    const now = this.clock.now();
    try {
      const row = await postgresTransactionOf(unitOfWork)
        .insertInto('users')
        .values({
          id: toUuid(account.id),
          email: storedAddress(account.email),
          password_hash: account.passwordHash,
          name: account.name.trim(),
          is_verified: true,
          auth_provider: AuthProvider.EMAIL,
          primary_provider: AuthProvider.EMAIL,
          created_at: now,
          updated_at: now,
        })
        .returning(['id', 'email', 'name', 'role'])
        .executeTakeFirstOrThrow();
      return new PostgresActivatedAccount(
        row.id,
        row.email ?? '',
        row.name ?? '',
        row.role,
      );
    } catch (error) {
      throw accountFailure(error);
    }
  }

  async readMovedAccount(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<MovedAccount | null> {
    const row = await postgresTransactionOf(unitOfWork)
      .selectFrom('users')
      .select(['id', 'email', 'address_generation'])
      .where('id', '=', toUuid(userId))
      .where('is_deleted', '=', false)
      .forNoKeyUpdate()
      .noWait()
      .executeTakeFirst();
    return row
      ? new PostgresMovedAccount(
          row.id,
          row.email ?? '',
          row.address_generation,
        )
      : null;
  }

  async markAddressVerified(
    unitOfWork: UnitOfWork,
    account: MovedAccount,
  ): Promise<void> {
    if (!(account instanceof PostgresMovedAccount)) {
      throw new Error('This account was not read from PostgreSQL');
    }
    await postgresTransactionOf(unitOfWork)
      .updateTable('users')
      .set({ is_verified: true, updated_at: this.clock.now() })
      .where('id', '=', account.id)
      .execute();
  }
}

/**
 * A stand-in for the sign-in service, which is not on this database yet. It
 * issues nothing: it answers with the account the activation stored.
 */
export class PostgresActivationSignIn extends ActivationSignIn {
  complete(account: ActivatedAccount): Promise<ActivationSignInOutcome> {
    if (!(account instanceof PostgresActivatedAccount)) {
      throw new Error('This account was not stored on PostgreSQL');
    }
    return Promise.resolve({
      requiresTwoFactor: false,
      user: {
        id: account.id,
        email: account.email,
        name: account.name,
        role: account.role,
        authProvider: AuthProvider.EMAIL,
        isVerified: true,
        permissions: [],
      },
    });
  }
}
