# Backend

NestJS 11 API with MongoDB, authentication, and role-based access control.

## Quick Start

```bash
npm install
npm run migration:up     # Apply migrations
npm run seed             # Seed test data
npm run start:dev        # Development (http://localhost:5000)
npm run build            # Production build
npm run start:prod       # Production server
```

## Tech Stack

- **NestJS 11** - Node.js framework
- **TypeScript 5.7** - Type safety
- **MongoDB** - Database
- **Mongoose 8** - ODM
- **bcrypt** - Password hashing
- **Nodemailer** - Email service
- **Passport** - OAuth strategies

## Project Structure

```
src/
├── auth/               # Authentication module
│   ├── controllers/    # Auth endpoints
│   ├── services/       # Auth logic
│   ├── guards/         # AuthGuard, registered globally
│   ├── dto/            # Request/Response DTOs
│   └── decorators/     # @Public, @CurrentUser
├── user/               # User module
│   ├── schemas/        # User schema
│   └── enums/          # UserRole enum
├── session/            # Session module
├── permission/         # Permission module
├── mail/               # Email service
├── database/           # DB config, migrations, seeds
└── common/             # Shared utilities
```

## Environment Variables

Create `.env`:

```bash
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/authboiler
CLIENT_URL=http://localhost:3000

# SMTP
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@yourapp.com

# OAuth (optional)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
FACEBOOK_APP_ID=your-app-id
FACEBOOK_APP_SECRET=your-secret
GITHUB_CLIENT_ID=your-client-id
GITHUB_CLIENT_SECRET=your-secret

# Security
BCRYPT_ROUNDS=10
SESSION_EXPIRES_IN=604800000  # 7 days

# Swagger (development only)
SWAGGER_ENABLED=true
```

## API Endpoints

### Authentication (Public)

| Method | Endpoint                    | Description         |
| ------ | --------------------------- | ------------------- |
| POST   | `/api/auth/register`        | Register with email |
| POST   | `/api/auth/activate`        | Verify email code   |
| POST   | `/api/auth/login`           | Login               |
| POST   | `/api/auth/logout`          | Logout              |
| POST   | `/api/auth/forgot-password` | Request reset       |
| POST   | `/api/auth/reset-password`  | Reset password      |
| POST   | `/api/auth/oauth/authorize` | Get OAuth URL       |
| POST   | `/api/auth/oauth/callback`  | OAuth callback      |

### User (Protected)

| Method | Endpoint                           | Description       |
| ------ | ---------------------------------- | ----------------- |
| GET    | `/api/user/profile`                | Get profile       |
| PATCH  | `/api/user/profile`                | Update profile    |
| POST   | `/api/user/password`               | Change password   |
| GET    | `/api/user/sessions`               | List sessions     |
| DELETE | `/api/user/sessions/:id`           | Revoke session    |
| POST   | `/api/user/sessions/revoke-others` | Revoke all others |

### Admin (Protected + Permission)

| Method | Endpoint                    | Description |
| ------ | --------------------------- | ----------- |
| GET    | `/api/admin/users`          | List users  |
| PATCH  | `/api/admin/users/:id/role` | Update role |
| DELETE | `/api/admin/users/:id`      | Delete user |

## Database

### Commands

```bash
npm run migration:create <name>  # Create migration
npm run migration:up             # Apply migrations
npm run migration:down           # Rollback
npm run migration:status         # Check status
npm run seed                     # Seed data
npm run seed:reset               # Clear and reseed
```

### Models

**User**

```typescript
{
  email: string;
  password: string;      // bcrypt hashed
  name: string;
  role: 'user' | 'support' | 'manager' | 'admin';
  isVerified: boolean;
  googleId?: string;
  facebookId?: string;
  githubId?: string;
}
```

**Session**

```typescript
{
  user: ObjectId;
  token: string;
  userAgent: string;
  ip: string;
  isValid: boolean;
  expiresAt: Date; // TTL auto-cleanup
}
```

### Seed Users

| Role    | Email              | Password    |
| ------- | ------------------ | ----------- |
| USER    | user@seed.local    | User123!    |
| SUPPORT | support@seed.local | Support123! |
| MANAGER | manager@seed.local | Manager123! |
| ADMIN   | admin@seed.local   | Admin123!   |

## Role Hierarchy

```
ADMIN (4)     Full system access
    ↓
MANAGER (3)   Team management
    ↓
SUPPORT (2)   Customer service
    ↓
USER (1)      Default role
```

## Guards

```typescript
// Public route (no auth)
@Public()
@Post('register')

// Every route needs a valid session: AuthGuard runs as APP_GUARD
@Get('profile')

// Opt out for routes that anyone may call
@Public()
@Post('login')
```

## API Documentation

Enable Swagger: Set `SWAGGER_ENABLED=true`

- **Swagger UI**: http://localhost:5000/api/docs
- **OpenAPI JSON**: http://localhost:5000/api/docs-json
- **Postman Collection**: See `docs/postman/`

## Testing

```bash
npm test              # Unit tests
npm run test:watch    # Watch mode
npm run test:cov      # Coverage
npm run test:e2e      # E2E tests
```

## Docker

```bash
docker build -t backend .
docker run -p 5000:5000 --env-file .env backend
```

Or use `docker compose up` from root directory.

## Documentation

- [Database Management](docs/database-management.md)
- [Authentication Flow](docs/authentication-flow.md)
- [User Roles & Permissions](docs/user-roles-permissions.md)
- [API Responses](docs/api-responses.md)
- [OAuth Authentication](docs/oauth-authentication.md)
