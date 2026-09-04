# Full-Stack Authentication Boilerplate

Production-ready authentication system with **NestJS** backend and **Next.js** frontend.

## Features

### Authentication

- Email/password registration with 6-digit verification code
- Google OAuth login
- Facebook OAuth login
- GitHub OAuth login
- Password reset via email
- Multi-session management with device tracking
- Account linking (connect multiple OAuth providers)
- Profile synchronization across providers

### Authorization (RBAC)

- Dynamic role-based access control
- Role management with custom permissions
- Direct user permission assignment
- Permission inheritance from roles
- Protected system roles (admin, superadmin)
- Permission-based UI rendering

### Session Management

- View all active sessions with device info
- Device type detection (Desktop, Mobile, Tablet)
- Browser and OS identification
- IP address tracking
- Individual session termination
- Bulk logout (all other devices)

### Security

- bcrypt password hashing
- Email verification required
- Rate limiting on auth endpoints
- CORS configuration
- Helmet security headers
- Input validation and sanitization
- HTTP-only cookies

### Dashboard

- Role management (CRUD operations)
- Permission management
- User management
- Responsive navigation
- Mobile-first sidebar

### Code Quality

- Pre-commit hooks (linting, formatting, testing)
- TypeScript strict mode
- Conventional commits enforcement
- ESLint + Prettier
- E2E tests with Playwright

## Tech Stack

| Layer    | Technology                               |
| -------- | ---------------------------------------- |
| Backend  | NestJS 11, TypeScript, MongoDB, Mongoose |
| Frontend | Next.js 16, React 19, Tailwind CSS 4     |
| State    | Redux Toolkit (RTK Query)                |
| UI       | shadcn/ui, Radix UI, Lucide Icons        |
| i18n     | next-intl                                |
| Testing  | Jest, Playwright                         |

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-username/FULL-MERN-AUTH-Boilerplate.git
cd FULL-MERN-AUTH-Boilerplate
npm install

# Start with Docker (recommended)
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up --build

# Or start manually
cd backend && npm install && npm run start:dev
cd frontend && npm install && npm run dev
```

**Access:**

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- API Docs: http://localhost:5000/api/docs (set `SWAGGER_ENABLED=true`)

## Project Initialization

Use the interactive CLI to configure the boilerplate for your project:

```bash
npm run init
```

The script will prompt you for:

| Configuration     | Description                                        |
| ----------------- | -------------------------------------------------- |
| App name          | Your project name (generates slug & database name) |
| Description       | Project description for package.json & README      |
| Author            | Author name for package.json                       |
| Ports             | Frontend (3000) and backend (5001) ports           |
| MongoDB URI       | Database connection string                         |
| SMTP settings     | Email configuration (optional)                     |
| OAuth credentials | Google, Facebook, GitHub (optional)                |

**Files updated automatically:**

- `package.json` (root, backend, frontend)
- `backend/.env` and `frontend/.env.local`
- `docker-compose.yml` and `docker-compose.prod.yml`
- `README.md` files

## Production Deployment

Configure your application for production with domains, SSL, and Docker:

```bash
npm run setup:prod
docker compose --env-file .env -f docker-compose.prod.yml up -d --build
```

The production setup wizard will configure:

| Configuration    | Description                              |
| ---------------- | ---------------------------------------- |
| Domain names     | Main, frontend, and API domains          |
| SSL certificates | Let's Encrypt or self-signed             |
| MongoDB          | Production database credentials          |
| Nginx ports      | HTTP (80) and HTTPS (443) ports          |
| Docker Compose   | Production-ready container configuration |

**What it does:**

- Creates production `.env` file with all settings
- Updates `docker-compose.prod.yml` with your domains
- Configures Nginx for reverse proxy and SSL
- Generates SSL certificates (self-signed or Let's Encrypt ready)
- Backs up existing configuration files

## Documentation

| Guide                                   | Description                         |
| --------------------------------------- | ----------------------------------- |
| [Frontend README](./frontend/README.md) | Frontend setup, components, testing |
| [Backend README](./backend/README.md)   | Backend setup, API, database        |
| [Setup Guides](./docs/README.md)        | SMTP, OAuth, deployment guides      |
| [Code Quality](./docs/code-quality.md)  | Linting, testing, commits           |
| [Deployment](./docs/deployment.md)      | Docker, Vercel deployment           |

## Project Structure

```
/
├── backend/     # NestJS API (auth, user, session, permission modules)
├── frontend/    # Next.js app (pages, components, modules)
├── docs/        # Setup guides and documentation
└── openspec/    # Spec-driven development docs
```

## API Overview

| Endpoint                        | Description            |
| ------------------------------- | ---------------------- |
| `POST /api/auth/register`       | Register with email    |
| `POST /api/auth/activate`       | Verify email with code |
| `POST /api/auth/login`          | Login                  |
| `POST /api/auth/logout`         | Logout                 |
| `POST /api/auth/oauth/callback` | OAuth callback         |
| `GET /api/user/profile`         | Get profile            |
| `PATCH /api/user/profile`       | Update profile         |
| `POST /api/user/password`       | Change password        |
| `GET /api/user/sessions`        | List sessions          |
| `DELETE /api/user/sessions/:id` | Revoke session         |

Full API documentation: [Backend README](./backend/README.md#api-endpoints)

## Environment Setup

**Backend** (`backend/.env`):

```bash
PORT=5000
MONGO_URI=mongodb://localhost:27017/authboiler
SMTP_HOST=smtp.gmail.com
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
GOOGLE_CLIENT_ID=your-client-id
```

**Frontend** (`frontend/.env.local`):

```bash
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
```

See [Setup Guides](./docs/README.md) for detailed configuration.

## Seed Data

```bash
cd backend
npm run seed
```

| Role    | Email              | Password    |
| ------- | ------------------ | ----------- |
| USER    | user@seed.local    | User123!    |
| SUPPORT | support@seed.local | Support123! |
| MANAGER | manager@seed.local | Manager123! |
| ADMIN   | admin@seed.local   | Admin123!   |

## Contributing

1. Create feature branch: `git checkout -b feat/feature-name`
2. Follow [Conventional Commits](https://conventionalcommits.org)
3. Ensure pre-commit checks pass
4. Submit PR to `master`

## License

MIT
