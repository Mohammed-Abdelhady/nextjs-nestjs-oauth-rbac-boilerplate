import { Kysely } from 'kysely';
import { RolePermissions } from '../../../src/role/stores/role-permissions';
import { PrototypeDatabase } from './postgres-database';

export class PostgresRolePermissions extends RolePermissions {
  constructor(private readonly database: Kysely<PrototypeDatabase>) {
    super();
  }

  async ofRole(slug: string): Promise<string[] | null> {
    const row = await this.database
      .selectFrom('roles')
      .select('permissions')
      .where('slug', '=', slug)
      .executeTakeFirst();
    return row ? [...row.permissions] : null;
  }
}
