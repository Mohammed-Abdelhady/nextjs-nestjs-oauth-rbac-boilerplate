# Full-stack authentication boilerplate

Production boilerplate with a NestJS 11 backend and a Next.js 16 frontend. Uses cookie-based sessions, dynamic role-based access control, and multiple authentication options.

## Features

- Email and password registration with a 6-digit verification code sent by email
- Magic link sign-in sent by email
- Two-factor authentication (TOTP) with single-use recovery codes
- Passkey (WebAuthn) registration and authentication
- 12 OAuth providers plus generic OIDC
- Dynamic role-based access control with role hierarchy, custom permissions, and direct user overrides
- Multi-session management with device, browser, OS, and IP tracking
- Account linking across multiple OAuth providers
- Dynamic runtime auth method discovery via `GET /api/auth/methods`

## Tech stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Backend  | NestJS 11, TypeScript, MongoDB, Mongoose 8        |
| Frontend | Next.js 16 (App Router), React 19, Tailwind CSS 4 |
| State    | Redux Toolkit (RTK Query)                         |
| UI       | shadcn/ui, Radix UI, Lucide Icons                 |
| i18n     | next-intl                                         |
| Tests    | Jest, Playwright                                  |

## Scaffold a new project

To scaffold a project with only the authentication methods you want:

```bash
pnpm dlx create-nest-next-auth my-app
```

The CLI prompts for the sign-in methods to keep. It removes unused strategy files, controller endpoints, frontend UI modules, environment variables, and setup docs. See [CLI options and flags](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/blob/master/packages/create-nest-next-auth/README.md).

## Choose your auth methods

At runtime, the frontend calls `GET /api/auth/methods` to learn which authentication flows the backend enables. The backend checks its configuration and returns the active providers, credential toggles, magic link availability, passkey support, and two-factor requirements. The frontend renders only the matching forms and buttons.

| Method              | Type                  | Setup guide                                            |
| ------------------- | --------------------- | ------------------------------------------------------ |
| Email and password  | Credential            | [SMTP setup](docs/setup/setup-smtp.md)                 |
| Magic link          | Passwordless          | [Magic link setup](docs/setup/setup-magic-link.md)     |
| Two-factor (TOTP)   | Second factor         | [Two-factor setup](docs/setup/setup-two-factor.md)     |
| Passkeys (WebAuthn) | Credential / 2FA      | [Passkey setup](docs/setup/setup-passkeys.md)          |
| Google              | OAuth 2.0             | [Google setup](docs/setup/setup-google-oauth.md)       |
| GitHub              | OAuth 2.0             | [GitHub setup](docs/setup/setup-github-oauth.md)       |
| Facebook            | OAuth 2.0             | [Facebook setup](docs/setup/setup-facebook-oauth.md)   |
| Apple               | OAuth 2.0 / Form post | [Apple setup](docs/setup/setup-apple-oauth.md)         |
| Discord             | OAuth 2.0             | [Discord setup](docs/setup/setup-discord-oauth.md)     |
| GitLab              | OIDC                  | [GitLab setup](docs/setup/setup-gitlab-oauth.md)       |
| LinkedIn            | OIDC                  | [LinkedIn setup](docs/setup/setup-linkedin-oauth.md)   |
| Microsoft           | OAuth 2.0             | [Microsoft setup](docs/setup/setup-microsoft-oauth.md) |
| Generic OIDC        | OIDC                  | [OIDC setup](docs/setup/setup-oidc-oauth.md)           |
| Slack               | OIDC                  | [Slack setup](docs/setup/setup-slack-oauth.md)         |
| Twitch              | OIDC                  | [Twitch setup](docs/setup/setup-twitch-oauth.md)       |
| X (Twitter)         | OAuth 2.0 with PKCE   | [X setup](docs/setup/setup-x-oauth.md)                 |

## Quick start

Use Node 22 (22.12 or newer) and pnpm 12.6.0. Node 22 includes Corepack. Enable the pinned manager before cloning or scaffolding:

```bash
nvm use 22
corepack enable
corepack prepare pnpm@12.6.0 --activate
pnpm --version
```

<!-- repository-only:start -->

Clone the repository:

```bash
git clone https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate.git
cd nextjs-nestjs-oauth-rbac-boilerplate
```

<!-- repository-only:end -->

Install dependencies from the project folder:

```bash
pnpm install
```

<!-- feature:docker:start -->

### Start with Docker

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build
```

<!-- feature:docker:end -->

Copy the example configuration files:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

### Start manually

```bash
# In one terminal, start the backend:
pnpm --filter backend run start:dev

# In another terminal, start the frontend:
pnpm --filter frontend run dev
```

Endpoints:

- Frontend: http://localhost:3000
- Backend API: http://localhost:5001/api
- Health check: http://localhost:5001/health
- Swagger documentation: http://localhost:5001/api/docs (set `SWAGGER_ENABLED=true` in `backend/.env`)

## Environment configuration

### Key backend variables (`backend/.env`)

| Variable                        | Description                                                            | Default                                               |
| ------------------------------- | ---------------------------------------------------------------------- | ----------------------------------------------------- |
| `PORT`                          | API server port. Example file sets `5001`.                             | `3000` when unset                                     |
| `NODE_ENV`                      | Environment name                                                       | `development`                                         |
| `MONGO_URI`                     | MongoDB URI                                                            | `mongodb://localhost:27017/authboiler?replicaSet=rs0` |
| `FRONTEND_URL`                  | Frontend origin for CORS and cookie domain                             | `http://localhost:3000`                               |
| `SESSION_SECRET`                | Secret used to sign session cookies                                    | Required in production                                |
| `OAUTH_STATE_SECRET`            | Secret used to sign OAuth state cookies                                | Required in production                                |
| `AUTH_NATIVE_DPOP_NONCE_SECRET` | HMAC secret for DPoP nonces; required when `AUTH_NATIVE_ENABLED=true`  | At least 32 characters when native sign-in is enabled |
| `API_URL`                       | Public origin of the API; required when `AUTH_NATIVE_ENABLED=true`     | `http://localhost:<PORT>`; https origin in production |
| `AUTH_NATIVE_DPOP_REQUIRED`     | Reject native exchanges without DPoP and refreshes of unbound families | `false`                                               |
| `TOTP_ENCRYPTION_KEY`           | 32-byte hex key to encrypt TOTP secrets                                | Required for 2FA                                      |

### Key frontend variables (`frontend/.env.local`)

| Variable              | Description                          | Default                 |
| --------------------- | ------------------------------------ | ----------------------- |
| `NEXT_PUBLIC_API_URL` | Backend origin without `/api` suffix | `http://localhost:5001` |

See [docs/README.md](docs/README.md) for provider-specific credentials and mail settings.

For a host-run backend with MongoDB in Docker Compose, use `MONGO_URI=mongodb://USER:PASS@localhost:27017/authboiler?authSource=admin&directConnection=true`. The replica set advertises `mongodb:27017`, which only containers on the Compose network can resolve. <!-- feature:docker -->

## Seed data

Run the database seed script from the backend directory:

```bash
cd backend
pnpm run seed
```

The script runs only when `NODE_ENV` is `development` or `test`. It creates four system roles (`user`, `support`, `manager`, `admin`) and two seed accounts:

| Email              | Default role | Password                                         |
| ------------------ | ------------ | ------------------------------------------------ |
| `admin@seed.local` | `admin`      | Generated random base64 string printed to stdout |
| `user@seed.local`  | `user`       | Generated random base64 string printed to stdout |

To set explicit passwords for seed accounts, set `SEED_ADMIN_PASSWORD` and `SEED_USER_PASSWORD` in `backend/.env` before running the command.

To wipe and reseed the database:

```bash
pnpm --filter backend run seed:reset
```

## Documentation

| Guide                                                   | Description                                                            |
| ------------------------------------------------------- | ---------------------------------------------------------------------- |
| [Architecture](docs/reference/ARCHITECTURE.md)          | Request lifecycle, session storage, OAuth registry, and security model |
| [Database schema](docs/reference/DATABASE_SCHEMA.md)    | MongoDB collections, indexes, and migrations                           |
| [RBAC system](docs/access-control/RBAC-SYSTEM.md)       | Role levels, permission inheritance, and enforcement guards            |
| [Migration guide](docs/operations/MIGRATION-GUIDE.md)   | Database migration scripts and versioning                              |
| [Production setup](docs/operations/PRODUCTION-SETUP.md) | Domain configuration, SSL termination, and Nginx reverse proxy         |
| [Code quality](docs/reference/code-quality.md)          | Linting, formatting, git hooks, and E2E tests                          |
| [Deployment](docs/operations/deployment.md)             | Docker Compose and cloud deployment guides                             |
| [Backend guide](backend/README.md)                      | Backend modules, controllers, and configuration schema                 |
| [Frontend guide](frontend/README.md)                    | Frontend routing, components, and internationalization                 |

## Contributing

1. Create a feature branch: `git checkout -b feat/feature-name`
2. Follow [Conventional Commits](https://conventionalcommits.org) format for commit messages.
3. Verify that tests and lint checks pass: `pnpm run lint && pnpm run test`
4. Submit a pull request.

## License

MIT
