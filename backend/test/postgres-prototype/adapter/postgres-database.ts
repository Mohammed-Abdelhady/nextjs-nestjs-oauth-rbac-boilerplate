import { ColumnType, Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';

type Timestamp = ColumnType<Date, Date, Date>;
/** `bigint` comes back as text. Lifetimes in milliseconds fit a number. */
type BigIntColumn = ColumnType<string, number, number>;

export interface UsersTable {
  id: Generated<string>;
  is_deleted: Generated<boolean>;
  session_version: Generated<number>;
  issuance_fence: Generated<number>;
}

export interface ApplicationsTable {
  client_id: string;
  environment: string;
  platform: string;
  enabled: Generated<boolean>;
  session_version: Generated<number>;
  allowed_scopes: Generated<string[]>;
  absolute_lifetime_ms: BigIntColumn;
  idle_lifetime_ms: BigIntColumn;
}

export interface UserApplicationGrantsTable {
  id: Generated<string>;
  user_id: string;
  client_id: string;
  allowed: Generated<boolean>;
  allowed_scopes: Generated<string[]>;
  session_version: Generated<number>;
  issuance_fence: Generated<number>;
}

export interface SessionsTable {
  id: Generated<string>;
  user_id: string;
  token_hash: Buffer;
  csrf_token: string | null;
  user_agent: string;
  device: ColumnType<unknown, string | null, string | null>;
  device_name: string | null;
  ip: string;
  is_valid: Generated<boolean>;
  revoked_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  client_id: string;
  user_version: number;
  client_version: number;
  grant_version: number;
  auth_epoch: number;
  schema_version: number;
  scopes: string[];
  audience: string;
  authentication_methods: string[];
  credential_purpose: string;
  browser_generation: number;
  authenticated_at: Timestamp;
  last_used_at: Timestamp;
  last_activity_at: Timestamp;
  expires_at: Timestamp;
  idle_expires_at: Timestamp;
}

export interface SecurityEventsTable {
  id: Generated<string>;
  event_id: string;
  target_user_id: string | null;
  client_id: string | null;
  session_id: string | null;
  action: string;
  outcome: string;
  occurred_at: Timestamp;
}

export interface PrototypeDatabase {
  users: UsersTable;
  applications: ApplicationsTable;
  user_application_grants: UserApplicationGrantsTable;
  sessions: SessionsTable;
  security_events: SecurityEventsTable;
}

export function openPrototypeDatabase(
  pool: Pool,
  dialect: PostgresDialect = new PostgresDialect({ pool }),
): Kysely<PrototypeDatabase> {
  return new Kysely<PrototypeDatabase>({ dialect });
}
