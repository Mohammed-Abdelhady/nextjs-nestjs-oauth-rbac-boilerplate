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

## More sections

- [Two-factor challenges and seed data](database-schema-two-factor-challenges.md)
