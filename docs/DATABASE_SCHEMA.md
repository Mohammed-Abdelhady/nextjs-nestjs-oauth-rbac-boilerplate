# Database schema design

This document describes the MongoDB collections, documents, indexes, and migrations used by the backend.

## Entity relationship diagram

```
┌────────────────────────┐         ┌────────────────────────┐
│          USER          │         │          ROLE          │
│                        │         │                        │
│ - _id: ObjectId        │         │ - _id: ObjectId        │
│ - email: string        │         │ - name: string         │
│ - name: string         │         │ - slug: string (unique)│
│ - password?: string    │         │ - permissions: string[]│
│ - role: string ────────┼────────►│ - level: number        │
│ - permissions: string[]│         │ - isProtected: boolean │
│ - isActive: boolean    │         │ - isSystemRole: boolean│
│ - twoFactor: object    │         └────────────────────────┘
│ - linkedAccounts: []   │
└───────────┬────────────┘
            │ 1
            │
            ├──────────────────────┬──────────────────────┐
            │ *                    │ *                    │ *
┌───────────▼────────────┐ ┌───────▼────────────────┐ ┌───▼────────────────────┐
│        SESSION         │ │        PASSKEY         │ │  TWO_FACTOR_CHALLENGE  │
│                        │ │                        │ │                        │
│ - _id: ObjectId        │ │ - _id: ObjectId        │ │ - _id: ObjectId        │
│ - userId: ObjectId     │ │ - userId: ObjectId     │ │ - userId: ObjectId     │
│ - tokenHash: string    │ │ - credentialId: string │ │ - nonceHash: string    │
│ - device: object       │ │ - publicKey: Buffer    │ │ - rememberMe: boolean  │
│ - lastActiveAt: Date   │ │ - counter: number      │ │ - attempts: number     │
│ - expiresAt: Date(TTL) │ │ - backedUp: boolean    │ │ - expiresAt: Date(TTL) │
└────────────────────────┘ └────────────────────────┘ └────────────────────────┘

Temporary flow collections (self-expiring via TTL):
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────────┐
│  PENDING_REGISTRATION  │ │ PENDING_PASSWORD_RESET │ │   PENDING_MAGIC_LINK   │
│                        │ │                        │ │                        │
│ - email: string        │ │ - email: string        │ │ - email: string        │
│ - name: string         │ │ - tokenHash: string    │ │ - tokenHash: string    │
│ - passwordHash: string │ │ - expiresAt: Date(TTL) │ │ - consumedAt?: Date    │
│ - codeHash: string     │ └────────────────────────┘ │ - expiresAt: Date(TTL) │
│ - expiresAt: Date(TTL) │                            └────────────────────────┘
└────────────────────────┘
```

## Collections

### 1. Users (`users`)

The `users` collection stores registered user identities, password credentials, role assignments, direct permissions, and linked third-party providers.

```typescript
{
  _id: ObjectId,
  email: string,                    // Lowercase, trimmed, unique
  name: string,                     // Trimmed
  password?: string,                // bcrypt hash. Excluded from default queries.
  role: string,                     // Role slug (for example 'user', 'admin'). Default: 'user'
  permissions: string[],            // Direct permission overrides. Default: []
  isActive: boolean,                // Account state toggle. Default: true
  twoFactor: {
    enabled: boolean,               // Default: false
    secret?: string,                // AES-256 encrypted TOTP secret. Excluded by default.
    recoveryCodes?: string[]        // bcrypt hashed recovery codes. Excluded by default.
  },
  linkedAccounts: [
    {
      provider: string,             // Lowercase provider identifier ('google', 'github', etc.)
      providerAccountId: string,    // Provider unique subject identifier
      email?: string,               // Email reported by the provider
      name?: string,                // Display name from the provider
      avatarUrl?: string,           // Profile image URL
      linkedAt: Date                // Timestamp when linked
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{ email: 1 }                                                      // unique
{ role: 1 }                                                       // index
{ "linkedAccounts.provider": 1, "linkedAccounts.providerAccountId": 1 } // unique, sparse
{ createdAt: -1 }                                                 // sorting index
```

### 2. Sessions (`sessions`)

The `sessions` collection tracks active browser sessions. The raw session token is sent to the client in an HTTP-only cookie. Only the SHA-256 hash of the token is stored in the database.

```typescript
{
  _id: ObjectId,
  userId: ObjectId,                 // Reference to users._id
  tokenHash: string,                // SHA-256 hash of the session token
  device: {
    browser: string,                // Parsed browser name
    os: string,                     // Parsed operating system
    deviceType: string,             // 'desktop' | 'mobile' | 'tablet'
    userAgent: string,              // Raw User-Agent string
    ip: string                      // Client IP address
  },
  lastActiveAt: Date,               // Updated on request activity
  expiresAt: Date,                  // Session expiration timestamp
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{ tokenHash: 1 }                      // unique
{ userId: 1, expiresAt: 1 }           // user sessions query index
{ expiresAt: 1 }                      // expireAfterSeconds: 0 (TTL index)
```

MongoDB deletes expired documents automatically when the `expiresAt` timestamp passes.

### 3. Roles (`roles`)

The `roles` collection defines access levels and assigned permissions. Roles decouple permission lists from user documents.

```typescript
{
  _id: ObjectId,
  name: string,                     // Human-readable name
  slug: string,                     // Unique slug ('user', 'support', 'manager', 'admin')
  description?: string,             // Optional summary of role duties
  permissions: string[],            // Permission strings granted to the role
  level: number,                    // Hierarchy level. Higher values have higher authority.
  isProtected: boolean,             // If true, role configuration cannot be changed.
  isSystemRole: boolean,            // If true, role cannot be removed.
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{
  slug: 1;
} // unique
{
  level: 1;
} // hierarchy comparison index
```

`User.role` references `Role.slug` directly as a string. Role lookups query by slug rather than Mongoose `populate()`.

### 4. Pending registrations (`pendingregistrations`)

Stores unverified sign-up attempts. A user document is created only after the 6-digit code sent by email is confirmed.

```typescript
{
  _id: ObjectId,
  email: string,                    // Lowercase, trimmed, unique
  name: string,                     // Trimmed
  passwordHash: string,             // bcrypt hash of the intended password
  codeHash: string,                 // Hash of the 6-digit activation code
  attempts: number,                 // Verification attempt counter. Default: 0
  lastResendAt: Date,               // Rate-limiting timestamp for resend requests
  expiresAt: Date,                  // Expiration timestamp (default: 15 minutes)
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{
  email: 1;
} // unique
{
  expiresAt: 1;
} // expireAfterSeconds: 0 (TTL index)
```

### 5. Pending password resets (`pendingpasswordresets`)

Tracks password reset requests. Stores the SHA-256 hash of the reset token sent to the user's email address.

```typescript
{
  _id: ObjectId,
  email: string,                    // Target user email
  tokenHash: string,                // SHA-256 hash of the reset token
  expiresAt: Date,                  // Expiration timestamp (default: 1 hour)
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{
  tokenHash: 1;
} // unique
{
  email: 1;
} // lookup index
{
  expiresAt: 1;
} // expireAfterSeconds: 0 (TTL index)
```

### 6. Pending magic links (`pendingmagiclinks`)

Stores single-use login tokens generated for passwordless email authentication.

```typescript
{
  _id: ObjectId,
  email: string,                    // Target user email
  tokenHash: string,                // SHA-256 hash of the magic link token
  consumedAt?: Date,                // Set when the link is verified
  expiresAt: Date,                  // Expiration timestamp (default: 15 minutes)
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{
  tokenHash: 1;
} // unique
{
  email: 1;
} // lookup index
{
  expiresAt: 1;
} // expireAfterSeconds: 0 (TTL index)
```

### 7. Passkeys (`passkeys`)

Stores WebAuthn public key credentials registered for a user account. Used for passwordless login and second-factor verification.

```typescript
{
  _id: ObjectId,
  userId: ObjectId,                 // Reference to users._id
  credentialId: string,             // Base64url credential ID
  publicKey: Buffer,                // COSE format public key buffer
  counter: number,                  // Authenticator sign count for clone detection
  deviceType?: string,              // 'singleDevice' | 'multiDevice'
  backedUp: boolean,                // Passkey sync backup state
  transports?: string[],            // ['usb', 'nfc', 'ble', 'internal']
  name: string,                     // User label (for example 'MacBook Touch ID')
  lastUsedAt?: Date,                // Timestamp of last successful authentication
  createdAt: Date,
  updatedAt: Date
}
```

Indexes:

```javascript
{
  credentialId: 1;
} // unique
{
  userId: 1;
} // user credentials query index
```

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

Database migrations live in `backend/migrations/` and run with `npm run migration:up`.

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
npm run migration:status
```

## Seed behavior

Seed data initializes roles and test accounts in development:

```bash
cd backend
npm run seed
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
npm run seed:reset
```
