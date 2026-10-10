-- Pending codes, their mail counters and mailed sign-in links.
-- PostgreSQL has no TTL index. A row stays after it expires until a
-- deleteExpiredBefore call removes it, so no statement may read "stored" as
-- "still valid".

CREATE TABLE mail_counters (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  email text NOT NULL,
  purpose text NOT NULL,
  mailed_codes integer NOT NULL DEFAULT 1,
  window_started_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  CONSTRAINT mail_counter_email_purpose_unique UNIQUE (email, purpose)
);

CREATE INDEX mail_counter_expires_at ON mail_counters (expires_at);

-- user_id is the account an email change is bound to. It carries no foreign
-- key yet: accounts move to this database in a later step.
CREATE TABLE pending_registrations (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  email text NOT NULL,
  purpose text NOT NULL,
  user_id uuid,
  address_generation integer,
  hashed_code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  CONSTRAINT pending_registration_email_purpose_unique UNIQUE (email, purpose)
);

CREATE INDEX pending_registration_expires_at
  ON pending_registrations (expires_at);

CREATE TABLE pending_password_resets (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  email text NOT NULL,
  hashed_code text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  expires_at timestamptz NOT NULL,
  CONSTRAINT pending_password_reset_email_unique UNIQUE (email)
);

CREATE INDEX pending_password_reset_expires_at
  ON pending_password_resets (expires_at);

CREATE TABLE pending_magic_links (
  id uuid PRIMARY KEY DEFAULT uuidv7(),
  email text NOT NULL,
  token_hash text NOT NULL,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  request_ip text,
  user_agent text,
  redirect text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pending_magic_link_token_hash_unique UNIQUE (token_hash)
);

CREATE INDEX pending_magic_link_email_created
  ON pending_magic_links (email, created_at DESC);

CREATE INDEX pending_magic_link_expires_at ON pending_magic_links (expires_at);

-- What a mailed link reads and writes on an account. The columns are nullable
-- because accounts seeded for browser sign-in and for roles carry none of
-- them. An account created here takes the default role from 0002.
ALTER TABLE users
  ADD COLUMN email text,
  ADD COLUMN name text,
  ADD COLUMN is_verified boolean NOT NULL DEFAULT false,
  ADD COLUMN auth_provider text,
  ADD COLUMN primary_provider text,
  ADD CONSTRAINT user_email_unique UNIQUE (email);
