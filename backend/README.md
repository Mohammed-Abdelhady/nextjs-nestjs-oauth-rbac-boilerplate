# Backend

NestJS 11 API with MongoDB, cookie-based sessions, dynamic RBAC, two-factor authentication, passkeys, and OAuth.

## Quick start

```bash
npm install
npm run migration:up     # Apply migrations
npm run seed             # Seed roles and test accounts
npm run start:dev        # Development server (http://localhost:5000)
npm run build            # Production build
npm run start:prod       # Production server
```

## Tech stack

- **NestJS 11** on Express
- **TypeScript 5.x** with strict mode
- **MongoDB 7** with **Mongoose 8**
- **bcrypt** for password hashing
- **Nodemailer** with SMTP transport
- **@simplewebauthn/server** for WebAuthn passkeys
- **Custom OAuth provider registry** for OAuth 2.0 and OIDC

## Project structure

```
src/
├── auth/               # Authentication, sessions, 2FA, passkeys, and OAuth
│   ├── oauth/          # Unified OAuth provider registry and strategies
│   ├── passkeys/       # WebAuthn options and verification
│   ├── services/       # Auth logic
│   └── guards/         # SessionAuthGuard, RolesGuard, PermissionsGuard
├── user/               # User profile and linked account management
├── role/               # Role CRUD and hierarchy
├── admin/              # User administration and direct permission assignment
├── session/            # Session management and device metadata
├── mail/               # Nodemailer email dispatch
├── database/           # Mongoose schemas, migrations, seeds
├── health/             # Health check endpoint
└── common/             # Interceptors, filters, DTOs, and constants
```

## Key environment variables

Configure these in `backend/.env`:

```bash
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/authboiler
FRONTEND_URL=http://localhost:3000

# Session and state security
SESSION_SECRET=your-secure-session-secret
OAUTH_STATE_SECRET=your-secure-oauth-state-secret
TOTP_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

# SMTP email service
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourapp.com

# OAuth providers (optional)
OAUTH_GOOGLE_CLIENT_ID=your-client-id
OAUTH_GOOGLE_CLIENT_SECRET=your-client-secret
OAUTH_GOOGLE_CALLBACK_URL=http://localhost:5000/api/auth/oauth/google/callback

# Swagger API docs
SWAGGER_ENABLED=true
```

## API endpoints

### Authentication (`/api/auth`)

| Method | Endpoint                    | Description                         | Auth    |
| ------ | --------------------------- | ----------------------------------- | ------- |
| POST   | `/api/auth/register`        | Register new account                | Public  |
| POST   | `/api/auth/resend-code`     | Resend verification code            | Public  |
| POST   | `/api/auth/activate`        | Verify account with 6-digit code    | Public  |
| POST   | `/api/auth/login`           | Email/password sign-in              | Public  |
| POST   | `/api/auth/logout`          | Revoke session cookie               | Session |
| POST   | `/api/auth/forgot-password` | Request password reset token        | Public  |
| POST   | `/api/auth/reset-password`  | Reset password using token          | Public  |
| GET    | `/api/auth/methods`         | List enabled authentication options | Public  |

### Magic link (`/api/auth/magic-link`)

| Method | Endpoint                      | Description                  | Auth   |
| ------ | ----------------------------- | ---------------------------- | ------ |
| POST   | `/api/auth/magic-link/send`   | Send passwordless login link | Public |
| POST   | `/api/auth/magic-link/verify` | Consume magic link token     | Public |

### Two-factor authentication (`/api/auth/2fa`)

| Method | Endpoint                       | Description                            | Auth             |
| ------ | ------------------------------ | -------------------------------------- | ---------------- |
| POST   | `/api/auth/2fa/generate`       | Generate TOTP secret and QR code       | Session          |
| POST   | `/api/auth/2fa/enable`         | Verify code and enable 2FA             | Session          |
| POST   | `/api/auth/2fa/verify`         | Complete login challenge               | Challenge cookie |
| POST   | `/api/auth/2fa/disable`        | Disable two-factor authentication      | Session          |
| POST   | `/api/auth/2fa/recovery-codes` | Generate new single-use recovery codes | Session          |

### Passkeys (`/api/auth/passkeys` and `/api/user/passkeys`)

| Method | Endpoint                              | Description                       | Auth    |
| ------ | ------------------------------------- | --------------------------------- | ------- |
| POST   | `/api/auth/passkeys/login/options`    | Get WebAuthn assertion options    | Public  |
| POST   | `/api/auth/passkeys/login/verify`     | Verify passkey login assertion    | Public  |
| POST   | `/api/user/passkeys/register/options` | Get WebAuthn registration options | Session |
| POST   | `/api/user/passkeys/register/verify`  | Save new passkey public key       | Session |
| GET    | `/api/user/passkeys`                  | List registered passkeys          | Session |
| DELETE | `/api/user/passkeys/:id`              | Remove a passkey                  | Session |

### OAuth (`/api/auth/oauth`)

| Method | Endpoint                             | Description                      | Auth   |
| ------ | ------------------------------------ | -------------------------------- | ------ |
| GET    | `/api/auth/oauth/providers`          | List enabled OAuth providers     | Public |
| GET    | `/api/auth/oauth/:provider/start`    | Start OAuth login flow           | Public |
| GET    | `/api/auth/oauth/:provider/callback` | OAuth redirect callback          | Public |
| POST   | `/api/auth/oauth/:provider/callback` | OAuth form post callback (Apple) | Public |

### User profile and sessions (`/api/user`)

| Method | Endpoint                        | Description                      | Auth    |
| ------ | ------------------------------- | -------------------------------- | ------- |
| GET    | `/api/user/profile`             | Get authenticated user profile   | Session |
| PATCH  | `/api/user/profile`             | Update profile information       | Session |
| POST   | `/api/user/password`            | Change account password          | Session |
| GET    | `/api/user/providers`           | List linked social identities    | Session |
| DELETE | `/api/user/providers/:provider` | Unlink a social identity         | Session |
| GET    | `/api/user/sessions`            | List active user sessions        | Session |
| DELETE | `/api/user/sessions/:id`        | Revoke a specific session        | Session |
| DELETE | `/api/user/sessions/all`        | Revoke all other active sessions | Session |

### Roles (`/api/roles`)

| Method | Endpoint         | Description                      | Required permission |
| ------ | ---------------- | -------------------------------- | ------------------- |
| GET    | `/api/roles`     | List all roles                   | `roles:read`        |
| POST   | `/api/roles`     | Create a new role                | `roles:write`       |
| GET    | `/api/roles/:id` | Get role details                 | `roles:read`        |
| PUT    | `/api/roles/:id` | Update role permissions or level | `roles:write`       |
| DELETE | `/api/roles/:id` | Delete custom role               | `roles:write`       |

### Administration (`/api/admin`)

| Method | Endpoint                           | Description                       | Required permission  |
| ------ | ---------------------------------- | --------------------------------- | -------------------- |
| GET    | `/api/admin/users`                 | Paginated list of users           | `users:read`         |
| GET    | `/api/admin/users/:id`             | Get user details                  | `users:read`         |
| PATCH  | `/api/admin/users/:id/role`        | Update user role assignment       | `users:manage_roles` |
| PATCH  | `/api/admin/users/:id/status`      | Activate or deactivate account    | `users:write`        |
| DELETE | `/api/admin/users/:id`             | Remove user account               | `users:delete`       |
| GET    | `/api/admin/permissions`           | List all system permissions       | `permissions:read`   |
| POST   | `/api/admin/users/:id/permissions` | Assign direct permission override | `permissions:assign` |

### Health check

| Method | Endpoint  | Description                | Auth   |
| ------ | --------- | -------------------------- | ------ |
| GET    | `/health` | Server and database status | Public |

## Database management

```bash
npm run migration:create <name>  # Create migration script
npm run migration:up             # Apply pending migrations
npm run migration:down           # Revert last migration batch
npm run migration:status         # Show migration history
npm run seed                     # Seed roles and development accounts
npm run seed:reset               # Wipe database and reseed
```

### Seed accounts

The seed script creates two test users in development environments:

| Account            | Role    | Password                                                          |
| ------------------ | ------- | ----------------------------------------------------------------- |
| `admin@seed.local` | `admin` | Random base64 string printed to stdout (or `SEED_ADMIN_PASSWORD`) |
| `user@seed.local`  | `user`  | Random base64 string printed to stdout (or `SEED_USER_PASSWORD`)  |

## Documentation

- [Authentication flow](docs/authentication-flow.md)
- [OAuth authentication](docs/oauth-authentication.md)
- [User roles and permissions](docs/user-roles-permissions.md)
- [Database management](docs/database-management.md)
- [API responses](docs/api-responses.md)
- [Postman collection](docs/postman/README.md)
