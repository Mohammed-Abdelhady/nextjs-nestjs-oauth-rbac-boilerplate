# Logging, testing, and troubleshooting

[Guide overview](project.md)

### Logging Strategy

-   **Backend**: Use Winston or Pino for structured logging
-   **Log Levels**: error, warn, info, debug
-   **Never Log**:
    -   Passwords (plain or hashed)
    -   Session cookies
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

1. **Backend**: Create endpoint behind the global session AuthGuard
2. **Frontend**: Create page in `app/(protected)/` directory
3. **Middleware**: Add route protection logic if needed
4. **Tests**: Write E2E test for the flow

### Adding a New Authentication Method

1. Create change proposal in `openspec/changes/`
2. Add a provider strategy in `auth/oauth/strategies/` (or a passwordless module)
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

**Issue**: Session validation fails
-   Verify the `sid` cookie is sent (`credentials: 'include'`)
-   Check session expiry
-   Confirm the cookie was issued on the same origin/path

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
-   Check the session cookie (`sid`) and `credentials: 'include'`
-   Verify AuthProvider / AuthGuard wrap protected routes
-   Confirm `getCurrentUser` succeeds before treating `isAuthenticated` as truth

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
  linkedAccounts: { provider, providerId, linkedAt }[],
  primaryProvider?: string,
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
