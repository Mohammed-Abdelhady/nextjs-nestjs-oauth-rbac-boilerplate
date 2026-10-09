import { ColumnType, Generated, Kysely, PostgresDialect } from 'kysely';
import { Pool } from 'pg';
import { commitCheckedPool } from './postgres-commit-tag';

type Timestamp = ColumnType<Date, Date, Date>;
/** `bigint` comes back as text. Lifetimes in milliseconds fit a number. */
type BigIntColumn = ColumnType<string, number, number>;

export interface UsersTable {
  id: Generated<string>;
  is_deleted: Generated<boolean>;
  session_version: Generated<number>;
  issuance_fence: Generated<number>;
  role: Generated<string>;
  permissions: Generated<string[]>;
  email: string | null;
  name: string | null;
  is_verified: Generated<boolean>;
  auth_provider: string | null;
  primary_provider: string | null;
}

export interface RolesTable {
  id: Generated<string>;
  name: string;
  slug: string;
  description: string | null;
  is_system_role: Generated<boolean>;
  is_protected: Generated<boolean>;
  level: number | null;
  permissions: Generated<string[]>;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface RolePendingSweepsTable {
  id: Generated<string>;
  owner_role_id: string;
  role_id: string;
  previous_slug: string;
  actor_id: string;
  sweep_id: string | null;
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
  actor_id: string | null;
  reason_code: string | null;
  assigned_role_id: string | null;
  previous_role_id: string | null;
  assignment_session_version: number | null;
  deleted_role_id: string | null;
  deleted_role_slug: string | null;
  deletion_sweep_id: string | null;
  deletion_pending: boolean | null;
  request_id: string | null;
  purge_after: ColumnType<Date, Date | undefined, never>;
}

export interface BrowserProofsTable {
  id: Generated<string>;
  proof_id_hash: string;
  token_hash: string;
  expires_at: Timestamp;
  spent: Generated<boolean>;
}

export interface MailCountersTable {
  id: Generated<string>;
  email: string;
  purpose: string;
  mailed_codes: Generated<number>;
  window_started_at: Timestamp;
  expires_at: Timestamp;
}

export interface PendingRegistrationsTable {
  id: Generated<string>;
  email: string;
  purpose: string;
  user_id: string | null;
  address_generation: number | null;
  hashed_code: string;
  attempts: Generated<number>;
  expires_at: Timestamp;
}

export interface PendingPasswordResetsTable {
  id: Generated<string>;
  email: string;
  hashed_code: string;
  attempts: Generated<number>;
  expires_at: Timestamp;
}

export interface PendingMagicLinksTable {
  id: Generated<string>;
  email: string;
  token_hash: string;
  expires_at: Timestamp;
  consumed_at: ColumnType<Date | null, Date | null | undefined, Date | null>;
  request_ip: string | null;
  user_agent: string | null;
  redirect: string | null;
  created_at: ColumnType<Date, Date | undefined, never>;
}

export interface PrototypeDatabase {
  users: UsersTable;
  applications: ApplicationsTable;
  user_application_grants: UserApplicationGrantsTable;
  sessions: SessionsTable;
  security_events: SecurityEventsTable;
  roles: RolesTable;
  role_pending_sweeps: RolePendingSweepsTable;
  mail_counters: MailCountersTable;
  pending_registrations: PendingRegistrationsTable;
  pending_password_resets: PendingPasswordResetsTable;
  pending_magic_links: PendingMagicLinksTable;
  browser_proofs: BrowserProofsTable;
}

/**
 * Opens the database on a pool that reads every COMMIT's command tag. A caller
 * that passes its own dialect builds it on `commitCheckedPool` too.
 */
export function openPrototypeDatabase(
  pool: Pool,
  dialect: PostgresDialect = new PostgresDialect({
    pool: commitCheckedPool(pool),
  }),
): Kysely<PrototypeDatabase> {
  return new Kysely<PrototypeDatabase>({ dialect });
}
