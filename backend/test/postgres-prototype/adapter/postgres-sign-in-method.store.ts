import { EMAIL_PROVIDER } from '../../../src/common/constants/oauth-providers';
import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import {
  HeldSignInMethods,
  SignInMethodStore,
} from '../../../src/user/stores/sign-in-method.store';
import { toUuid } from './postgres-issuance-mappers';
import { postgresTransactionOf } from './postgres-unit-of-work';

/**
 * The fence is the account's row lock, the one the other account workflows
 * take. A second unit of work is refused there at once (`NOWAIT`), which the
 * runner reports as a retryable abort. Everything is counted after the lock:
 * under read committed a count made before it could be stale by then.
 */
export class PostgresSignInMethodStore extends SignInMethodStore {
  async holdForAccount(
    unitOfWork: UnitOfWork,
    userId: string,
  ): Promise<HeldSignInMethods | null> {
    const work = postgresTransactionOf(unitOfWork);
    const account = await work
      .selectFrom('users')
      .select(['id', 'auth_provider', 'password_hash'])
      .where('id', '=', toUuid(userId))
      .forNoKeyUpdate()
      .noWait()
      .executeTakeFirst();
    if (!account) {
      return null;
    }
    const links = await work
      .selectFrom('user_linked_accounts')
      .select('provider')
      .where('user_id', '=', account.id)
      .orderBy('id')
      .execute();
    const passkeys = await work
      .selectFrom('passkeys')
      .select((select) => select.fn.countAll<string>().as('rows'))
      .where('user_id', '=', account.id)
      .executeTakeFirstOrThrow();

    return {
      emailSignIn: (account.auth_provider ?? EMAIL_PROVIDER) === EMAIL_PROVIDER,
      hasPassword: Boolean(account.password_hash),
      linkedProviders: links.map((link) => link.provider),
      passkeys: Number.parseInt(passkeys.rows, 10),
    };
  }
}
