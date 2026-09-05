# Project Context

## Purpose

This is a full-stack MERN authentication boilerplate project that provides comprehensive user authentication functionality including:

-   User registration and login with email verification
-   Social authentication (Facebook, Google OAuth)
-   Password reset and forgot password functionality
-   Protected routes for authenticated users
-   Admin dashboard and role-based access control

The project is currently being refactored from an older Express/React stack to a modern NestJS/Next.js architecture while maintaining all existing authentication features.

## Tech Stack

### Backend (NestJS)

-   **Framework**: NestJS 11 (Node.js framework)
-   **Language**: TypeScript 5.x
-   **Platform**: Express.js
-   **Database**: MongoDB 7 with Mongoose 8 ODM
-   **Authentication**:
    -   Stateful cookie sessions (`sid` in development, `__Host-sid` in production)
    -   Cryptographic token hashing: SHA-256 `tokenHash` stored in database
    -   Password hashing: bcrypt
    -   Two-factor authentication: TOTP with encrypted secrets and recovery codes
    -   Passkeys: WebAuthn with `@simplewebauthn/server`
    -   OAuth: Provider registry supporting 12 identity providers plus generic OIDC
-   **Email Service**: Nodemailer with SMTP transport
-   **Validation**: class-validator and class-transformer for DTOs
-   **Security**:
    -   Helmet for HTTP security headers
    -   Rate limiting with `@nestjs/throttler`
    -   CORS configuration
-   **Testing**: Jest for unit tests, Supertest for E2E
-   **Code Quality**: ESLint, Prettier
-   **Build Tool**: NestJS CLI

### Frontend (Next.js)

-   **Framework**: Next.js 16 with App Router
-   **Language**: TypeScript 5.x
-   **UI Library**: React 19
-   **Styling**: Tailwind CSS 4
-   **Components**: shadcn/ui, Radix UI, Lucide Icons
-   **State Management & Data Fetching**: Redux Toolkit with RTK Query
-   **Form Validation**: React Hook Form with Zod
-   **Internationalization**: next-intl
-   **Testing**: Playwright for E2E testing

### Database

-   **Primary Database**: MongoDB 7
-   **ODM**: Mongoose 8
-   **Collections**: `users`, `sessions`, `roles`, `pendingregistrations`, `pendingpasswordresets`, `pendingmagiclinks`, `passkeys`, `twofactorchallenges`
-   **TTL Indexes**: Automatic expiration for sessions, verification codes, and temporary challenges

## Project Conventions

### Code Style

#### Backend (NestJS)

-   **Linting**: ESLint with TypeScript support and Prettier integration
-   **Formatting**: Prettier with single quotes and trailing commas
-   **TypeScript**: Strict type checking enabled (no `any` types)
-   **File Structure**: Modular NestJS structure with modules, controllers, services, DTOs
-   **Naming Conventions**:
    -   Classes: PascalCase (e.g., `AppController`, `AuthService`, `UserEntity`)
    -   Methods/Functions: camelCase (e.g., `createUser`, `validateToken`, `findByEmail`)
    -   Constants: UPPER_SNAKE_CASE (e.g., `API_KEY`, `MAX_LOGIN_ATTEMPTS`, `JWT_EXPIRY`)
    -   Files: kebab-case for modules (e.g., `auth.module.ts`, `user.service.ts`)
    -   DTOs: Suffix with `Dto` (e.g., `CreateUserDto`, `LoginDto`, `UpdateProfileDto`)
    -   Interfaces: Prefix with `I` or suffix with `Interface` (e.g., `IUser`, `JwtPayload`)
    -   Enums: PascalCase (e.g., `UserRole`, `AuthProvider`)
-   **Import Order**:
    1. External dependencies
    2. NestJS imports
    3. Internal modules
    4. DTOs and interfaces
    5. Utilities and constants

#### Frontend (Next.js)

-   **Linting**: ESLint with Next.js recommended configuration
-   **Styling**: Tailwind CSS utility-first approach
-   **TypeScript**: Strict type checking enabled (no `any` types)
-   **File Structure**: App Router structure with route-based organization
-   **Naming Conventions**:
    -   Components: PascalCase (e.g., `LoginForm`, `Dashboard`, `UserCard`)
    -   Hooks: camelCase with 'use' prefix (e.g., `useAuth`, `useForm`, `useLocalStorage`)
    -   Utilities: camelCase (e.g., `formatDate`, `validateEmail`, `parseJwt`)
    -   Types: PascalCase (e.g., `User`, `AuthState`, `FormErrors`)
    -   Constants: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`, `TOKEN_KEY`)
-   **Component Structure**:
    -   Server Components by default (no `"use client"` unless needed)
    -   Client components only when using hooks, event handlers, or browser APIs
    -   Co-locate related components in feature folders
-   **Import Order**:
    1. React and Next.js imports
    2. External dependencies
    3. Internal components
    4. Hooks and utilities
    5. Types and constants

### Architecture Patterns

#### Backend Architecture

-   **Pattern**: Modular monolith with NestJS modules
-   **Layered Architecture**:
    -   **Controllers**: Handle HTTP requests/responses, route definitions, minimal logic
    -   **Services**: Business logic, data processing, orchestration
    -   **Repositories/Models**: Data access layer (Mongoose models)
    -   **DTOs**: Request/response validation with class-validator
    -   **Guards**: Authentication and authorization logic
    -   **Interceptors**: Response transformation, logging
    -   **Pipes**: Data validation and transformation
    -   **Filters**: Exception handling
-   **Dependency Injection**: NestJS built-in DI system (constructor injection)
-   **Module Structure** (planned):
    ```
    src/
    ├── auth/
    │   ├── auth.module.ts
    │   ├── auth.controller.ts
    │   ├── auth.service.ts
    │   ├── guards/
    │   │   ├── jwt-auth.guard.ts
    │   │   └── roles.guard.ts
    │   ├── strategies/
    │   │   ├── jwt.strategy.ts
    │   │   ├── google.strategy.ts
    │   │   └── facebook.strategy.ts
    │   └── dto/
    │       ├── register.dto.ts
    │       ├── login.dto.ts
    │       └── reset-password.dto.ts
    ├── user/
    │   ├── user.module.ts
    │   ├── user.controller.ts
    │   ├── user.service.ts
    │   ├── schemas/
    │   │   └── user.schema.ts
    │   └── dto/
    ├── mail/
    │   ├── mail.module.ts
    │   ├── mail.service.ts
    │   └── templates/
    ├── common/
    │   ├── decorators/
    │   ├── filters/
    │   ├── interceptors/
    │   └── pipes/
    └── config/
        └── configuration.ts
    ```
-   **Authentication**: JWT-based authentication with Passport strategies
-   **Database**: MongoDB with Mongoose ODM, typed schemas
-   **Error Handling**: Global exception filters with structured error responses
-   **Configuration**: @nestjs/config with environment validation

#### Frontend Architecture

-   **Pattern**: Component-based with Next.js App Router
-   **Directory Structure** (planned):
    ```
    src/
    ├── app/
    │   ├── (auth)/          # Auth routes group
    │   │   ├── login/
    │   │   ├── register/
    │   │   └── reset-password/
    │   ├── (protected)/     # Protected routes group
    │   │   ├── dashboard/
    │   │   └── profile/
    │   ├── layout.tsx
    │   └── page.tsx
    ├── components/
    │   ├── auth/
    │   ├── ui/              # Reusable UI components
    │   └── layout/
    ├── lib/
    │   ├── api/             # API client and endpoints
    │   ├── utils/           # Utility functions
    │   └── validation/      # Zod schemas
    ├── hooks/
    │   ├── useAuth.ts
    │   └── useLocalStorage.ts
    ├── context/
    │   └── AuthContext.tsx
    ├── types/
    │   ├── user.ts
    │   └── auth.ts
    └── constants/
        └── api.ts
    ```
-   **State Management**:
    -   React Context API for global auth state
    -   Local component state with useState/useReducer
    -   Server state via Next.js data fetching
-   **Routing**: File-based routing with App Router
    -   Route groups for logical organization
    -   Middleware for protected route handling
    -   Loading and error boundaries
-   **API Communication**:
    -   Native fetch API with custom wrapper
    -   Centralized API client in `lib/api/`
    -   Automatic token injection from auth context
    -   Error handling and retry logic
-   **Authentication Flow**:
    -   JWT tokens stored in httpOnly cookies (preferred) or localStorage
    -   AuthContext provides: user, token, isAuthenticated, login, logout, register
    -   Route protection via middleware or client-side guards

### Testing Strategy

#### Backend Testing

-   **Unit Tests**: Jest with ts-jest for TypeScript
-   **E2E Tests**: Jest with Supertest for API testing
-   **Coverage**: Jest coverage reports required
-   **Test Location**: `*.spec.ts` files alongside source code
-   **Test Environment**: Node.js environment

#### Frontend Testing

-   **Testing Framework**: Jest and React Testing Library (to be configured)
-   **Component Tests**: Test component rendering and user interactions
-   **Integration Tests**: Test user flows and API integration
-   **Coverage**: Aim for >80% coverage on critical paths

### Git Workflow

#### Branching Strategy

-   **Main Branch**: `master` (production-ready code) ⚠️ Note: This project uses `master` not `main`
-   **Feature Branches**: `feature/feature-name` (new features)
-   **Bugfix Branches**: `bugfix/bug-name` (bug fixes)
-   **Refactor Branches**: `refactor/refactor-name` (code refactoring)
-   **Current Branch**: `refactor/modern-stack-nestjs-nextjs`

#### Commit Conventions

-   **Format**: Conventional Commits (https://www.conventionalcommits.org/)
    -   `feat: add two-factor authentication`
    -   `fix: resolve token expiration bug in auth service`
    -   `refactor: extract email service from auth module`
    -   `docs: update API documentation for auth endpoints`
    -   `style: format code with prettier`
    -   `test: add e2e tests for login flow`
    -   `chore: upgrade nestjs to v11.1`
    -   `perf: optimize database queries for user lookup`
-   **Commit Messages**:
    -   Use imperative mood ("add" not "added")
    -   First line max 72 characters
    -   Body provides context if needed
-   **Commit Frequency**: Small, atomic commits with clear intent

#### Pull Request Process

-   PRs target `master` branch (not `main`)
-   PRs must pass all CI/CD checks (when configured)
-   Code review required before merging
-   PR description should include:
    -   **Purpose**: What changes and why
    -   **Testing**: Manual and automated testing performed
    -   **Breaking Changes**: Any backward-incompatible changes
    -   **Migration Steps**: If database or config changes required

## Domain Context

### Authentication Flow

1. **Registration**: User provides email/password → Server sends verification email → User verifies email
2. **Login**: User provides credentials → Server validates → Returns JWT token
3. **Social Auth**: User clicks Google/Facebook → OAuth flow → Server creates/updates user → Returns token
4. **Password Reset**: User requests reset → Server sends reset link → User creates new password
5. **Protected Routes**: Client includes token in requests → Server validates → Grants/denies access

### User Roles

-   **User**: Standard authenticated user (default)
-   **Admin**: Elevated permissions for user management, system operations

### API Endpoints Specification

All API endpoints prefixed with `/api/`

#### Authentication Endpoints

```
POST   /api/auth/register
       Body: { email, password, name }
       Response: { message: "Registration email sent" }
       Status: 200 (success), 400 (validation error), 409 (email exists)

POST   /api/auth/activate
       Body: { token: "activation-jwt-token" }
       Response: { token: "jwt", user: {...} }
       Status: 200 (success), 400 (invalid/expired token)

POST   /api/auth/signin
       Body: { email, password }
       Response: { token: "jwt", user: {...} }
       Status: 200 (success), 401 (invalid credentials), 403 (not verified)

POST   /api/auth/forgot-password
       Body: { email }
       Response: { message: "Reset email sent" }
       Status: 200 (always - prevent email enumeration)

POST   /api/auth/reset-password
       Body: { token, newPassword }
       Response: { message: "Password updated" }
       Status: 200 (success), 400 (invalid/expired token)

POST   /api/auth/google
       Body: { idToken: "google-oauth-token" }
       Response: { token: "jwt", user: {...} }
       Status: 200 (success), 401 (invalid token)

POST   /api/auth/facebook
       Body: { accessToken: "fb-access-token" }
       Response: { token: "jwt", user: {...} }
       Status: 200 (success), 401 (invalid token)
```

#### User Endpoints (Protected)

```
GET    /api/user/profile
       Headers: Authorization: Bearer <jwt>
       Response: { user: {...} }
       Status: 200 (success), 401 (unauthorized)

PUT    /api/user/profile
       Headers: Authorization: Bearer <jwt>
       Body: { name, ... } (password excluded)
       Response: { user: {...} }
       Status: 200 (success), 401 (unauthorized), 400 (validation)

GET    /api/user/list (Admin only)
       Headers: Authorization: Bearer <jwt>
       Query: ?page=1&limit=10
       Response: { users: [...], total, page, pages }
       Status: 200 (success), 401 (unauthorized), 403 (forbidden)
```

### Validation Rules

#### Password Requirements

-   Minimum length: 6 characters (from legacy - consider increasing to 8+)
-   Must contain: letters and numbers (strengthen in new implementation)
-   Maximum length: 128 characters
-   No common passwords (implement zxcvbn or similar)

#### Email Requirements

-   Valid email format (RFC 5322)
-   Maximum length: 255 characters
-   Normalized to lowercase
-   Unique in database

#### Name Requirements

-   Minimum length: 2 characters
-   Maximum length: 50 characters
-   Allow letters, spaces, hyphens, apostrophes
-   Trim whitespace

#### JWT Token Configuration

-   **Access Token**: Expires in 7 days (configurable via env)
-   **Activation Token**: Expires in 24 hours
-   **Reset Password Token**: Expires in 1 hour
-   **Algorithm**: HS256
-   **Payload**: `{ userId, email, role, iat, exp }`

### Security Considerations

#### Authentication Security

-   JWT tokens with secure secrets (min 32 characters)
-   Password hashing with bcrypt (work factor ≥10)
-   Email verification required before activation
-   Rate limiting on authentication endpoints:
    -   Login: 5 attempts per 15 minutes per IP
    -   Registration: 3 attempts per hour per IP
    -   Password reset: 3 requests per hour per email
-   Account lockout after 5 failed login attempts (consider implementing)

#### Data Security

-   HTTPS only in production
-   httpOnly cookies for token storage (prevents XSS)
-   CORS configured with whitelist origins
-   Helmet middleware for security headers
-   Input sanitization to prevent XSS/injection
-   MongoDB parameterized queries (prevents NoSQL injection)

#### OAuth Security

-   Verify tokens with OAuth provider APIs
-   Store provider IDs (googleId, facebookId) securely
-   Allow account linking with existing email

#### Privacy & Compliance

-   Hash passwords before storage (never plain text)
-   No sensitive data in logs (passwords, tokens)
-   User data deletion capability (GDPR right to erasure)
-   Clear privacy policy and terms of service

## Important Constraints

### Technical Constraints

-   Must maintain backward compatibility with existing authentication features
-   Migration from Express/React to NestJS/Next.js should preserve all functionality
-   Database schema must remain compatible with existing MongoDB collections
-   API endpoints should follow RESTful conventions
-   Frontend must be responsive and mobile-friendly

### Business Constraints

-   Email delivery reliability (SendGrid integration)
-   OAuth provider requirements (Google, Facebook)
-   Password security standards (minimum length, complexity)
-   Session management and token expiration

### Regulatory Constraints

-   GDPR compliance for user data
-   Secure storage of user credentials
-   Privacy policy compliance

## External Dependencies

### Backend Services (To be Integrated)

-   **SendGrid**: Email service for verification and password reset emails
-   **MongoDB**: NoSQL database for user data
-   **Google OAuth**: Google authentication provider
-   **Facebook OAuth**: Facebook authentication provider

### Frontend Services (To be Integrated)

-   **Google OAuth Client**: React Google Login library
-   **Facebook OAuth Client**: React Facebook Login library
-   **Axios**: HTTP client for API communication

### Development Tools

-   **NestJS CLI**: Project scaffolding and code generation
-   **Next.js CLI**: Development server and build tools
-   **TypeScript Compiler**: Type checking and compilation
-   **ESLint & Prettier**: Code quality and formatting

### Package Managers

-   **npm**: Node.js package manager
-   **Node.js**: Runtime environment (version 18+ recommended, 20 LTS preferred)

## Development Workflow

### Local Development Setup

1. **Prerequisites**:
   -   Node.js 18+ installed
   -   MongoDB 6+ running locally or accessible
   -   SendGrid API key (for email features)
   -   Google/Facebook OAuth credentials (for social auth)

2. **Backend Setup**:
   ```bash
   cd backend
   npm install
   cp .env.example .env  # Configure environment variables
   npm run start:dev      # Start with hot reload
   ```

3. **Frontend Setup**:
   ```bash
   cd frontend
   npm install
   cp .env.local.example .env.local  # Configure environment
   npm run dev            # Start Next.js dev server
   ```

4. **Database Setup**:
   ```bash
   # Start MongoDB (if using Docker)
   docker run -d -p 27017:27017 --name mongodb mongo:latest

   # Or use MongoDB Compass for GUI management
   ```

### Development Best Practices

#### Code Organization

-   **Single Responsibility**: Each module/component has one clear purpose
-   **DRY Principle**: Extract reusable logic into utilities/hooks
-   **Dependency Direction**: Services depend on interfaces, not concrete implementations
-   **Feature-First**: Organize by feature/domain, not by technical layer
-   **No God Objects**: Break large classes/components into smaller pieces

#### Before Committing

1. Run linter: `npm run lint` (both frontend and backend)
2. Run tests: `npm test` (backend)
3. Format code: `npm run format` (backend)
4. Verify build: `npm run build` (both)
5. Check TypeScript: `tsc --noEmit` (verify no type errors)

#### Code Review Checklist

-   [ ] No sensitive data (API keys, passwords) in code
-   [ ] TypeScript strict mode passes (no `any` types)
-   [ ] All new features have tests
-   [ ] Error handling implemented
-   [ ] Input validation on all endpoints/forms
-   [ ] Documentation updated (if API changes)
-   [ ] No console.log statements (use proper logging)
-   [ ] Migration scripts for database changes (if applicable)

## Deployment Considerations

### Production Environment Variables

Ensure all secrets are properly configured:

-   Use strong JWT secrets (min 32 characters, random)
-   Configure MONGO_URI with authentication
-   Set NODE_ENV=production
-   Configure CLIENT_URL with production domain
-   Enable HTTPS/SSL certificates
-   Set secure CORS origins

### Backend Deployment

-   Build: `npm run build`
-   Start: `npm run start:prod`
-   Process manager: PM2 or similar
-   Health check endpoint: `/api/health`
-   Graceful shutdown handling
-   Log aggregation (Winston, Pino)

### Frontend Deployment

-   Build: `npm run build`
-   Deploy to Vercel (recommended) or other platforms
-   Environment variables configured in platform
-   CDN for static assets
-   Image optimization enabled

### Database Deployment

-   MongoDB Atlas (recommended) or self-hosted
-   Enable authentication
-   Configure connection pooling
-   Regular backups scheduled
-   Monitoring and alerts

### Security Checklist for Production

-   [ ] HTTPS enabled (SSL/TLS certificates)
-   [ ] Environment variables secured (not in code)
-   [ ] CORS configured with specific origins (not *)
-   [ ] Rate limiting enabled
-   [ ] Helmet middleware configured
-   [ ] MongoDB authentication enabled
-   [ ] Database backups automated
-   [ ] Secrets rotated regularly
-   [ ] Security headers configured
-   [ ] Input sanitization on all endpoints
-   [ ] SQL/NoSQL injection prevention
-   [ ] XSS protection enabled
-   [ ] CSRF tokens for state-changing operations

## Monitoring and Logging

### Logging Strategy

-   **Backend**: Use Winston or Pino for structured logging
-   **Log Levels**: error, warn, info, debug
-   **Never Log**:
    -   Passwords (plain or hashed)
    -   JWT tokens
    -   API keys
    -   Sensitive user data (SSN, credit cards)
-   **Always Log**:
    -   Authentication attempts (success/failure)
    -   Authorization failures
    -   Rate limit hits
    -   Error stack traces (in dev only)
    -   Performance metrics

### Monitoring Metrics

-   API response times
-   Error rates by endpoint
-   Authentication success/failure rates
-   Database query performance
-   Memory and CPU usage
-   Active user sessions

### Health Checks

```typescript
// Backend health check endpoint
GET /api/health
Response: {
  status: 'ok',
  uptime: 12345,
  database: 'connected',
  memory: { ... },
  timestamp: '2024-01-16T...'
}
```

## Testing Strategy Details

### Backend Testing Approach

#### Unit Tests (`*.spec.ts`)

-   Test individual services in isolation
-   Mock external dependencies (database, email service)
-   Test business logic thoroughly
-   Coverage target: >80% for services

Example structure:
```typescript
describe('AuthService', () => {
  let service: AuthService;
  let userModel: Model<User>;

  beforeEach(async () => {
    // Setup test module with mocks
  });

  describe('register', () => {
    it('should create user and send verification email', async () => {
      // Arrange
      // Act
      // Assert
    });

    it('should throw error if email exists', async () => {
      // Test error case
    });
  });
});
```

#### E2E Tests (`test/*.e2e-spec.ts`)

-   Test complete API flows
-   Use test database
-   Test authentication and authorization
-   Test error scenarios
-   Coverage: All critical user journeys

Example:
```typescript
describe('Auth (e2e)', () => {
  it('POST /api/auth/register should create user', () => {
    return request(app.getHttpServer())
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'Test123', name: 'Test' })
      .expect(200)
      .expect(res => {
        expect(res.body.message).toContain('email sent');
      });
  });
});
```

### Frontend Testing Approach

#### Component Tests (React Testing Library)

-   Test user interactions
-   Test component rendering
-   Test form validation
-   Use `data-testid` for selectors (not text/classes)

Example:
```typescript
describe('LoginForm', () => {
  it('should submit form with valid credentials', async () => {
    const onSubmit = jest.fn();
    render(<LoginForm onSubmit={onSubmit} />);

    const emailInput = screen.getByTestId('email-input');
    const passwordInput = screen.getByTestId('password-input');
    const submitBtn = screen.getByTestId('submit-button');

    await userEvent.type(emailInput, 'test@example.com');
    await userEvent.type(passwordInput, 'password123');
    await userEvent.click(submitBtn);

    expect(onSubmit).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123'
    });
  });
});
```

#### E2E Tests (Playwright)

-   Test complete user flows
-   Test across browsers
-   Test authentication flows end-to-end
-   Use `data-testid` selectors

## Common Development Scenarios

### Adding a New Protected Route

1. **Backend**: Create endpoint with `@UseGuards(JwtAuthGuard)`
2. **Frontend**: Create page in `app/(protected)/` directory
3. **Middleware**: Add route protection logic if needed
4. **Tests**: Write E2E test for the flow

### Adding a New Authentication Method

1. Create change proposal in `openspec/changes/`
2. Add Passport strategy in `auth/strategies/`
3. Add controller endpoint in `auth.controller.ts`
4. Update AuthService with new method
5. Add DTO for validation
6. Update frontend with new auth button
7. Add tests for new flow

### Modifying User Schema

1. Create migration script in `migrations/`
2. Update Mongoose schema in `user.schema.ts`
3. Update DTOs if needed
4. Run migration on development database
5. Test thoroughly before production
6. Document breaking changes

## Troubleshooting Common Issues

### Backend Issues

**Issue**: Cannot connect to MongoDB
-   Check MONGO_URI in .env
-   Verify MongoDB is running
-   Check network connectivity

**Issue**: JWT token validation fails
-   Verify JWT_SECRET matches between creation and validation
-   Check token expiration
-   Ensure Authorization header format: `Bearer <token>`

**Issue**: Email not sending
-   Verify MAIL_KEY (SendGrid API key)
-   Check SendGrid dashboard for errors
-   Verify EMAIL_FROM is verified in SendGrid

### Frontend Issues

**Issue**: CORS errors
-   Configure CLIENT_URL in backend .env
-   Add CORS origin in NestJS configuration
-   Check protocol (http vs https)

**Issue**: Authentication not persisting
-   Check token storage (cookies/localStorage)
-   Verify AuthContext is properly wrapping app
-   Check token expiration

**Issue**: Next.js hydration errors
-   Ensure server and client render same content
-   Check for browser-only APIs in server components
-   Use `"use client"` directive when needed

## Migration Notes

### From Legacy to Modern Stack

-   **Backend**: Express.js → NestJS with TypeScript
-   **Frontend**: React 16 with CRA → Next.js 16 with App Router
-   **Styling**: Tailwind CSS → Tailwind CSS 4.x
-   **Build Tools**: Webpack → Next.js built-in bundler
-   **Testing**: Jest → Jest with improved configuration

### Features to Migrate

1. User registration with email verification
2. Email/password login
3. Google OAuth integration
4. Facebook OAuth integration
5. Forgot password functionality
6. Reset password functionality
7. Protected routes and authentication guards
8. Admin dashboard
9. User management (admin only)
10. Toast notifications for user feedback

### Database Schema (From Legacy)

#### Users Collection

```typescript
{
  _id: ObjectId,                    // Auto-generated MongoDB ID
  email: string,                    // Unique, required, indexed, lowercase
  password?: string,                // Hashed with bcrypt (optional for OAuth-only users)
  name: string,                     // Required, 2-50 characters
  role: 'user' | 'admin',          // Default: 'user'
  isVerified: boolean,              // Email verification status, default: false
  verificationToken?: string,       // JWT token for email verification
  resetPasswordToken?: string,      // JWT token for password reset
  resetPasswordExpires?: Date,      // Expiration for reset token
  googleId?: string,                // Google OAuth ID (indexed)
  facebookId?: string,              // Facebook OAuth ID (indexed)
  createdAt: Date,                  // Auto-generated timestamp
  updatedAt: Date                   // Auto-updated timestamp
}
```

#### Indexes

```javascript
// Ensure these indexes for performance and uniqueness
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ googleId: 1 }, { sparse: true });
db.users.createIndex({ facebookId: 1 }, { sparse: true });
db.users.createIndex({ createdAt: -1 });
```

### Environment Variables

#### Backend Environment Variables

```bash
# Server Configuration
PORT=3000                                   # Server port (default: 3000)
NODE_ENV=development                        # Environment: development | production | test

# Database
MONGO_URI=mongodb://localhost:27017/authboiler  # MongoDB connection string
MONGO_TEST_URI=mongodb://localhost:27017/authboiler-test  # Test database

# Frontend URL (for CORS and email links)
CLIENT_URL=http://localhost:3000            # Frontend application URL

# JWT Secrets (generate with: openssl rand -base64 32)
JWT_SECRET=your-super-secret-key-min-32-chars           # Main JWT secret
JWT_ACCOUNT_ACTIVATION=activation-secret-key            # Account activation token
JWT_RESET_PASSWORD=reset-password-secret-key            # Password reset token

# JWT Expiration
JWT_EXPIRES_IN=7d                           # Access token expiry (7 days)
JWT_ACTIVATION_EXPIRES_IN=24h               # Activation token expiry (24 hours)
JWT_RESET_EXPIRES_IN=1h                     # Reset token expiry (1 hour)

# Email Service (SendGrid)
MAIL_KEY=SG.your-sendgrid-api-key          # SendGrid API key
EMAIL_FROM=noreply@yourdomain.com           # Sender email address
EMAIL_FROM_NAME=Your App Name               # Sender name

# OAuth Configuration
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret

FACEBOOK_APP_ID=your-facebook-app-id
FACEBOOK_APP_SECRET=your-facebook-app-secret

# Rate Limiting
THROTTLE_TTL=60                             # Rate limit window (seconds)
THROTTLE_LIMIT=10                           # Max requests per window

# Security
BCRYPT_ROUNDS=10                            # Bcrypt work factor (10-12 recommended)
```

#### Frontend Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000/api    # Backend API base URL

# OAuth (Public Keys)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
NEXT_PUBLIC_FACEBOOK_APP_ID=your-facebook-app-id

# App Configuration
NEXT_PUBLIC_APP_NAME=Auth Boilerplate
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Error Handling Patterns

#### Backend Error Response Format

All errors return consistent structure:

```typescript
{
  statusCode: number,      // HTTP status code
  message: string,         // User-friendly error message
  error?: string,          // Error type (e.g., "Validation Error")
  details?: any            // Additional error details (dev only)
}
```

#### Error Categories

-   **400 Bad Request**: Invalid input, validation failures
-   **401 Unauthorized**: Missing or invalid authentication
-   **403 Forbidden**: Insufficient permissions
-   **404 Not Found**: Resource not found
-   **409 Conflict**: Duplicate resource (e.g., email exists)
-   **429 Too Many Requests**: Rate limit exceeded
-   **500 Internal Server Error**: Unexpected server error

#### Frontend Error Handling

-   Global error boundary for React errors
-   Toast notifications for user-facing errors
-   Form-level validation errors
-   Network error retry logic
-   Automatic token refresh on 401 (if using refresh tokens)

### Performance Considerations

#### Backend Optimization

-   Database connection pooling
-   Indexed database queries (email, provider IDs)
-   Rate limiting to prevent abuse
-   Compression middleware (gzip)
-   Request timeout configuration
-   Caching strategies for static data

#### Frontend Optimization

-   Server-side rendering for initial load
-   Code splitting with dynamic imports
-   Image optimization with Next.js Image
-   Font optimization (Geist fonts preloaded)
-   Minimize client-side JavaScript
-   Lazy load non-critical components
