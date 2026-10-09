import { Kysely } from 'kysely';
import {
  MAGIC_LINK_ACCOUNT_CONSTRAINT,
  MagicLinkAccount,
  MagicLinkAccounts,
  NewPasswordlessAccount,
} from '../../../src/auth/magic-link/stores/magic-link-accounts';
import {
  ClaimedMagicLink,
  MAGIC_LINK_CONSTRAINT,
  MagicLinkStore,
  NewMagicLink,
} from '../../../src/auth/magic-link/stores/magic-link.store';
import { PrototypeDatabase } from './postgres-database';
import {
  autocommit,
  removedRows,
  storedAddress,
} from './postgres-pending-codes-database';

const LINK_CONSTRAINTS = {
  pending_magic_link_token_hash_unique: MAGIC_LINK_CONSTRAINT.TOKEN_HASH,
} as const;

const ACCOUNT_CONSTRAINTS = {
  user_email_unique: MAGIC_LINK_ACCOUNT_CONSTRAINT.ADDRESS,
} as const;

const NONE = {} as const;
const EMAIL_PROVIDER = 'email';

export class PostgresMagicLinkStore extends MagicLinkStore {
  constructor(private readonly database: Kysely<PrototypeDatabase>) {
    super();
  }

  countRequestedSince(email: string, since: Date): Promise<number> {
    return autocommit(NONE, async () => {
      const row = await this.database
        .selectFrom('pending_magic_links')
        .select((select) => select.fn.countAll<string>().as('links'))
        .where('email', '=', storedAddress(email))
        .where('created_at', '>=', since)
        .executeTakeFirstOrThrow();
      return Number(row.links);
    });
  }

  async insertLink(link: NewMagicLink): Promise<void> {
    await autocommit(LINK_CONSTRAINTS, () =>
      this.database
        .insertInto('pending_magic_links')
        .values({
          email: storedAddress(link.email),
          token_hash: link.tokenHash,
          expires_at: link.expiresAt,
          consumed_at: null,
          request_ip: link.requestIp ?? null,
          user_agent: link.userAgent ?? null,
          redirect: link.redirect ?? null,
        })
        .execute(),
    );
  }

  claimLink(tokenHash: string, now: Date): Promise<ClaimedMagicLink | null> {
    return autocommit(NONE, async () => {
      const row = await this.database
        .updateTable('pending_magic_links')
        .set({ consumed_at: now })
        .where('token_hash', '=', tokenHash)
        .where('consumed_at', 'is', null)
        .returning(['email', 'expires_at', 'redirect'])
        .executeTakeFirst();
      if (!row) {
        return null;
      }
      return {
        email: row.email,
        expiresAt: row.expires_at,
        ...(row.redirect ? { redirect: row.redirect } : {}),
      };
    });
  }

  deleteExpiredBefore(cutoff: Date): Promise<number> {
    return autocommit(NONE, async () =>
      removedRows(
        await this.database
          .deleteFrom('pending_magic_links')
          .where('expires_at', '<=', cutoff)
          .executeTakeFirstOrThrow(),
      ),
    );
  }
}

class PostgresMagicLinkAccount extends MagicLinkAccount {
  constructor(
    readonly id: string,
    readonly isDeleted: boolean,
    readonly isVerified: boolean,
  ) {
    super();
  }
}

export class PostgresMagicLinkAccounts extends MagicLinkAccounts {
  constructor(private readonly database: Kysely<PrototypeDatabase>) {
    super();
  }

  findByEmail(email: string): Promise<MagicLinkAccount | null> {
    return autocommit(NONE, async () => {
      const row = await this.database
        .selectFrom('users')
        .select(['id', 'is_deleted', 'is_verified'])
        .where('email', '=', storedAddress(email))
        .executeTakeFirst();
      return row
        ? new PostgresMagicLinkAccount(row.id, row.is_deleted, row.is_verified)
        : null;
    });
  }

  async markVerified(account: MagicLinkAccount): Promise<void> {
    if (!(account instanceof PostgresMagicLinkAccount)) {
      throw new Error('This account was not read from PostgreSQL');
    }
    await autocommit(NONE, () =>
      this.database
        .updateTable('users')
        .set({ is_verified: true })
        .where('id', '=', account.id)
        .execute(),
    );
  }

  createPasswordless(
    account: NewPasswordlessAccount,
  ): Promise<MagicLinkAccount> {
    return autocommit(ACCOUNT_CONSTRAINTS, async () => {
      const row = await this.database
        .insertInto('users')
        .values({
          email: storedAddress(account.email),
          name: account.name,
          is_verified: true,
          auth_provider: EMAIL_PROVIDER,
          primary_provider: EMAIL_PROVIDER,
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      return new PostgresMagicLinkAccount(row.id, false, true);
    });
  }
}
