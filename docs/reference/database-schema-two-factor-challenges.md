# Two-factor challenges and seed data

[Guide overview](DATABASE_SCHEMA.md)

### 8. Two-factor challenges (`twofactorchallenges`)

Stores pending two-factor challenges issued during login when an account has 2FA enabled. The client receives a signed `2fa_challenge` cookie containing a nonce. The database stores the SHA-256 hash of the nonce.

```typescript
{
  _id: ObjectId,
  userId: ObjectId,                 // Target user identifier
  nonceHash: string,                // SHA-256 hash of the challenge nonce
  rememberMe: boolean,              // Preserved rememberMe choice for the session
  attempts: number,                 // Failed verification attempts
  expiresAt: Date,                  // Challenge expiration (default: 5 minutes)
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{
  nonceHash: 1;
} // unique
{
  userId: 1;
} // lookup index
{
  expiresAt: 1;
} // expireAfterSeconds: 0 (TTL index)
```

## Migrations

Database migrations live in `backend/migrations/` and run with `pnpm run migration:up`.

| Migration                                            | Purpose                                                                    |
| ---------------------------------------------------- | -------------------------------------------------------------------------- |
| `20260118000001-initial-indexes.js`                  | Creates unique index on `users.email` and initial indexes                  |
| `20260119000001-add-linked-providers.js`             | Sets default empty array for user linked providers                         |
| `20260903000001-session-token-hash.js`               | Converts plain session tokens to SHA-256 `tokenHash`                       |
| `20260904000001-add-default-permissions-to-users.js` | Backfills default permissions on existing user documents                   |
| `20260904000002-linked-accounts.js`                  | Migrates legacy flat OAuth fields into `linkedAccounts` subdocuments       |
| `20260904000003-backfill-email-primary-provider.js`  | Sets primary provider for accounts created prior to multi-provider linking |

To verify migration status:

```bash
cd backend
pnpm run migration:status
```

## Seed behavior

Seed data initializes roles and test accounts in development:

```bash
cd backend
pnpm run seed
```

The script runs only when `NODE_ENV` is `development` or `test`. Production environments reject the seed command.

### Seeded roles

| Slug      | Level | Protected | System role | Permissions                                                          |
| --------- | ----- | --------- | ----------- | -------------------------------------------------------------------- |
| `user`    | 1     | Yes       | Yes         | `profile:read`, `profile:write`, `sessions:read`, `sessions:write`   |
| `support` | 2     | Yes       | Yes         | User permissions plus `users:read`, `users:support`                  |
| `manager` | 3     | Yes       | Yes         | Support permissions plus `users:write`, `reports:read`, `audit:read` |
| `admin`   | 4     | Yes       | Yes         | All permissions (`*:*`)                                              |

### Seeded accounts

| Account            | Role    | Password source                                                 |
| ------------------ | ------- | --------------------------------------------------------------- |
| `admin@seed.local` | `admin` | `SEED_ADMIN_PASSWORD` or random base64 string printed to stdout |
| `user@seed.local`  | `user`  | `SEED_USER_PASSWORD` or random base64 string printed to stdout  |

To reset the database and reseed:

```bash
cd backend
pnpm run seed:reset
```
