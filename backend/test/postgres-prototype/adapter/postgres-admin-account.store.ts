import { Kysely, Transaction } from 'kysely';
import {
  AccountIdentityEdit,
  AdminAccountPage,
  AdminAccountQuery,
  AdminAccountStore,
  AssignableRole,
  CreatedAccountMark,
  NewAdminAccount,
} from '../../../src/admin/stores/admin-account.store';
import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import { AuthProvider } from '../../../src/user/enums/auth-provider.enum';
import { StoredAccount } from '../../../src/user/stores/stored-account';
import {
  ACCOUNT_COLUMNS,
  accountFailure,
  accountStatement,
  linkedAccountsOf,
  readAccount,
  storedId,
  toStoredAccount,
} from './postgres-account-rows';
import { PrototypeDatabase } from './postgres-database';
import { toUuid } from './postgres-issuance-mappers';
import { storedAddress } from './postgres-pending-codes-database';
import { postgresTransactionOf } from './postgres-unit-of-work';

type Work = Transaction<PrototypeDatabase>;

const SORT_COLUMNS: Readonly<
  Record<string, 'created_at' | 'updated_at' | 'email' | 'name' | 'role'>
> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  email: 'email',
  name: 'name',
  role: 'role',
};

/** `%`, `_` and the escape itself are taken literally in a search. */
function literalPattern(search: string): string {
  return `%${search.replace(/[\\%_]/g, (special) => `\\${special}`)}%`;
}

/**
 * Takes the target at `takeAccountForChange` with a row lock, the one sign-in
 * takes on an account. A second unit of work is refused there at once
 * (`NOWAIT`), which the runner reports as a retryable abort.
 */
export class PostgresAdminAccountStore extends AdminAccountStore {
  constructor(
    private readonly database: Kysely<PrototypeDatabase>,
    private readonly clock: { now(): Date },
  ) {
    super();
  }

  findAccount(userId: string): Promise<StoredAccount | null> {
    return accountStatement(() => readAccount(this.database, userId));
  }

  findAccountView(userId: string): Promise<StoredAccount | null> {
    return this.findAccount(userId);
  }

  listAccounts(query: AdminAccountQuery): Promise<AdminAccountPage> {
    return accountStatement(async () => {
      let matching = this.database.selectFrom('users');
      matching =
        query.role && query.viewableRoles.includes(query.role)
          ? matching.where('role', '=', query.role)
          : matching.where('role', 'in', query.viewableRoles);
      if (query.viewableRoles.length === 0) {
        return { accounts: [], total: 0 };
      }
      if (query.search) {
        const pattern = literalPattern(query.search);
        matching = matching.where((user) =>
          user.or([
            user('name', 'ilike', pattern),
            user('email', 'ilike', pattern),
          ]),
        );
      }
      const status = statusFilter(query);
      if (status.isVerified !== undefined) {
        matching = matching.where('is_verified', '=', status.isVerified);
      }
      if (status.isDeleted !== undefined) {
        matching = matching.where('is_deleted', '=', status.isDeleted);
      }
      const counted = await matching
        .select((user) => user.fn.countAll<string>().as('total'))
        .executeTakeFirstOrThrow();
      const rows = await matching
        .select(ACCOUNT_COLUMNS)
        .orderBy(SORT_COLUMNS[query.sortBy] ?? 'created_at', query.sortOrder)
        .orderBy('id', query.sortOrder)
        .offset((query.page - 1) * query.limit)
        .limit(query.limit)
        .execute();
      const accounts: StoredAccount[] = [];
      for (const row of rows) {
        accounts.push(
          toStoredAccount(row, await linkedAccountsOf(this.database, row.id)),
        );
      }
      return { accounts, total: Number.parseInt(counted.total, 10) };
    });
  }

  isAddressTaken(email: string): Promise<boolean> {
    return accountStatement(async () => {
      const row = await this.database
        .selectFrom('users')
        .select('id')
        .where('email', '=', storedAddress(email))
        .executeTakeFirst();
      return row !== undefined;
    });
  }

  findRole(roleId: string): Promise<AssignableRole | null> {
    return accountStatement(async () => {
      const row = await this.database
        .selectFrom('roles')
        .select(['id', 'slug'])
        .where('id', '=', toUuid(roleId))
        .executeTakeFirst();
      return row ?? null;
    });
  }

  findRoleBySlug(slug: string): Promise<AssignableRole | null> {
    return accountStatement(async () => {
      const row = await this.database
        .selectFrom('roles')
        .select(['id', 'slug'])
        .where('slug', '=', slug)
        .executeTakeFirst();
      return row ?? null;
    });
  }

  readAccount(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<StoredAccount | null> {
    return readAccount(postgresTransactionOf(unitOfWork), userId);
  }

  takeAccountForChange(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<StoredAccount | null> {
    return readAccount(postgresTransactionOf(unitOfWork), userId, true);
  }

  async readRoleBySlug(
    unitOfWork: UnitOfWork,
    slug: string,
  ): Promise<AssignableRole | null> {
    const row = await postgresTransactionOf(unitOfWork)
      .selectFrom('roles')
      .select(['id', 'slug'])
      .where('slug', '=', slug)
      .executeTakeFirst();
    return row ?? null;
  }

  saveActivation(
    unitOfWork: UnitOfWork,
    account: StoredAccount,
    deletedAt: Date | undefined,
  ): Promise<StoredAccount> {
    return this.save(postgresTransactionOf(unitOfWork), storedId(account), {
      is_deleted: deletedAt !== undefined,
      deleted_at: deletedAt ?? null,
    });
  }

  saveRole(
    unitOfWork: UnitOfWork,
    account: StoredAccount,
    slug: string,
  ): Promise<StoredAccount> {
    return this.save(postgresTransactionOf(unitOfWork), storedId(account), {
      role: slug,
    });
  }

  saveIdentity(
    unitOfWork: UnitOfWork,
    account: StoredAccount,
    edit: AccountIdentityEdit,
  ): Promise<StoredAccount> {
    return this.save(postgresTransactionOf(unitOfWork), storedId(account), {
      ...(edit.name === undefined ? {} : { name: edit.name.trim() }),
      ...(edit.address
        ? {
            email: storedAddress(edit.address.email),
            address_generation: edit.address.addressGeneration,
            is_verified: edit.address.isVerified,
          }
        : {}),
    });
  }

  async insertAccount(
    unitOfWork: UnitOfWork,
    account: NewAdminAccount,
  ): Promise<StoredAccount> {
    const now = this.clock.now();
    try {
      const row = await postgresTransactionOf(unitOfWork)
        .insertInto('users')
        .values({
          email: storedAddress(account.email),
          name: account.name.trim(),
          password_hash: account.passwordHash,
          role: account.role,
          is_verified: true,
          permissions: [],
          auth_provider: AuthProvider.EMAIL,
          primary_provider: AuthProvider.EMAIL,
          created_at: now,
          updated_at: now,
        })
        .returning(ACCOUNT_COLUMNS)
        .executeTakeFirstOrThrow();
      return toStoredAccount(row, []);
    } catch (error) {
      throw accountFailure(error);
    }
  }

  async removeCreatedAccount(
    unitOfWork: UnitOfWork,
    created: CreatedAccountMark,
  ): Promise<void> {
    await postgresTransactionOf(unitOfWork)
      .deleteFrom('users')
      .where('id', '=', toUuid(created.id))
      .where('role', '=', created.role)
      .where('updated_at', '=', created.updatedAt)
      .where('session_version', '=', created.sessionVersion)
      .execute();
  }

  private async save(
    work: Work,
    id: string,
    fields: {
      name?: string;
      email?: string;
      role?: string;
      address_generation?: number;
      is_verified?: boolean;
      is_deleted?: boolean;
      deleted_at?: Date | null;
    },
  ): Promise<StoredAccount> {
    try {
      await work
        .updateTable('users')
        .set({ ...fields, updated_at: this.clock.now() })
        .where('id', '=', id)
        .execute();
    } catch (error) {
      throw accountFailure(error);
    }
    const saved = await readAccount(work, id);
    if (!saved) {
      throw new Error('the account vanished inside its own unit of work');
    }
    return saved;
  }
}

function statusFilter(query: AdminAccountQuery): {
  isVerified?: boolean;
  isDeleted?: boolean;
} {
  if (query.status === 'deleted') {
    return { isVerified: query.isVerified, isDeleted: true };
  }
  if (query.status === 'inactive') {
    return { isVerified: false, isDeleted: false };
  }
  if (query.status === 'active') {
    return { isVerified: true, isDeleted: false };
  }
  return { isVerified: query.isVerified };
}
