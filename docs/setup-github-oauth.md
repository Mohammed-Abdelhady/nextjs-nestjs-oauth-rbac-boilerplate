# GitHub OAuth Setup Guide

This guide explains how to set up GitHub OAuth for social authentication in your application.

## Overview

GitHub OAuth allows users to sign in with their GitHub account. This is particularly useful for developer-focused applications.

**User Flow**:

1. User clicks "Sign in with GitHub"
2. Redirects to GitHub authorization page
3. User authorizes the app
4. GitHub redirects back with authorization code
5. Backend exchanges code for access token and user info
6. User is logged in

---

## Step 1: Register GitHub OAuth App

1. Log in to [GitHub](https://github.com/)
2. Click your **profile picture** (top right) → **Settings**
3. Scroll to **Developer settings** (bottom of left sidebar)
4. Click **OAuth Apps** → **New OAuth App**

---

## Step 2: Configure OAuth Application

Fill in the application details:

### Application Information

**Application name**: `Auth Boilerplate` (or your app name)

- This appears on the authorization screen
- Users will see "Authorize [Application name]"

**Homepage URL**:

- Development: `http://localhost:3000`
- Production: `https://yourdomain.com`

**Application description**: (optional)

```
Secure authentication system with email verification and social login.
```

- Brief description shown to users
- Max 400 characters

**Authorization callback URL**:

- Development: `http://localhost:5000/api/auth/oauth/github/callback`
- Production: `https://yourdomain.com/api/auth/oauth/github/callback`

**Important**:

- URL must match exactly (including protocol and port)
- You can only add ONE callback URL per OAuth app
- For multiple environments, create separate apps

### Register the Application

Click **Register application**.

---

## Step 3: Get Client Credentials

After registration, you'll see your app's credentials:

### Client ID

- Publicly visible identifier
- Format: `Iv1.1234567890abcdef`
- Safe to use in frontend code

### Client Secret

1. Click **Generate a new client secret**
2. Copy the secret immediately (you won't see it again)
3. Store securely in environment variables

**Warning**:

- Never commit client secret to version control
- Never expose in frontend code
- Reset if accidentally exposed

---

## Step 4: Configure Environment Variables

### Backend Configuration

Add to `backend/.env`:

```bash
# GitHub OAuth Configuration
OAUTH_GITHUB_CLIENT_ID=Iv1.1234567890abcdef
OAUTH_GITHUB_CLIENT_SECRET=your-client-secret-here
OAUTH_GITHUB_CALLBACK_URL=http://localhost:5000/api/auth/oauth/github/callback

# Production override
# OAUTH_GITHUB_CALLBACK_URL=https://yourdomain.com/api/auth/oauth/github/callback
```

### Frontend Configuration

The frontend discovers enabled OAuth providers by querying `GET /api/auth/oauth/providers`. When `OAUTH_GITHUB_CLIENT_ID` is present on the backend, the GitHub sign-in button appears automatically.

---

## Step 5: Test GitHub OAuth

### Using the Application

1. Start the backend:

   ```bash
   cd backend
   npm run start:dev
   ```

2. Start the frontend:

   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to `http://localhost:3000/auth/login`.
4. Click **Sign in with GitHub**.
5. Authorize the application on GitHub.
6. The browser redirects to `http://localhost:5000/api/auth/oauth/github/callback`, sets your session cookie, and returns to the dashboard.

### Manual Testing

Open the start endpoint directly in your browser:

```
http://localhost:5000/api/auth/oauth/github/start?redirect=/dashboard
```

The browser receives an HTTP 302 redirect with the signed state cookie and loads GitHub's authorization page.

### Test with GitHub's OAuth Tool

GitHub provides a test page:

1. Go to your OAuth app settings
2. Find **Authorization callback URL**
3. Click the URL to test the flow

---

## Step 6: Request User Permissions (Scopes)

By default, GitHub only grants access to public user data.

### Available Scopes

**User Data**:

- `user`: Read/write access to profile info
- `user:email`: Access user email addresses (including private)
- `user:follow`: Follow/unfollow users

**Repository Access**:

- `repo`: Full control of private repositories
- `public_repo`: Access public repositories
- `repo:status`: Access commit status

**Organization Access**:

- `read:org`: Read org membership
- `write:org`: Manage org membership
- `admin:org`: Full org access

### For Basic Authentication

Only request these scopes:

```typescript
const scopes = ['user:email', 'read:user'];
```

This provides:

- User's email addresses (including private)
- Basic profile information (name, avatar, bio)

### Requesting Scopes

In your authorization URL:

```typescript
const authUrl = new URL('https://github.com/login/oauth/authorize');
authUrl.searchParams.append('client_id', process.env.OAUTH_GITHUB_CLIENT_ID);
authUrl.searchParams.append('redirect_uri', process.env.OAUTH_GITHUB_CALLBACK_URL);
authUrl.searchParams.append('scope', 'user:email read:user');
authUrl.searchParams.append('state', stateToken);
```

---

## Step 7: Handle Private Emails

Some GitHub users hide their email addresses.

### Primary Email vs Private Email

GitHub users can:

- Make email private
- Use `noreply` email for commits
- Have multiple verified emails

### Get All User Emails

Request `user:email` scope and fetch emails:

```typescript
const response = await fetch('https://api.github.com/user/emails', {
  headers: {
    Authorization: `token ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  },
});

const emails = await response.json();
// Returns array of email objects
```

Response:

```json
[
  {
    "email": "user@example.com",
    "primary": true,
    "verified": true,
    "visibility": "public"
  },
  {
    "email": "12345678+user@users.noreply.github.com",
    "primary": false,
    "verified": true,
    "visibility": null
  }
]
```

### Get Primary Email

```typescript
const primaryEmail = emails.find((e) => e.primary && e.verified);
if (!primaryEmail) {
  throw new Error('No verified primary email found');
}
```

---

## Troubleshooting

### Error: "The redirect_uri MUST match the registered callback URL"

**Cause**: Callback URL doesn't match exactly.

**Solution**:

1. Check `OAUTH_GITHUB_CALLBACK_URL` in `backend/.env`
2. Verify it matches OAuth app settings exactly
3. Include protocol (`http://` or `https://`)
4. Include port (`:5000`)
5. No trailing slashes

Example:

- Correct: `http://localhost:5000/api/auth/oauth/github/callback`
- Wrong: `http://localhost:5000/api/auth/oauth/github/callback/`
- Wrong: `localhost:5000/api/auth/oauth/github/callback`

### Error: "Bad verification code"

**Cause**: Authorization code expired or already used.

**Solution**:

- Codes expire after 10 minutes
- Codes can only be used once
- User must re-authorize to get new code

### Error: "Incorrect client credentials"

**Cause**: Client ID or secret is wrong.

**Solution**:

1. Copy Client ID from OAuth app settings
2. Generate new client secret
3. Update `.env` files
4. Restart servers

### Error: "Application suspended"

**Cause**: GitHub suspended your OAuth app.

**Solution**:

1. Check email from GitHub for suspension reason
2. Fix policy violations
3. Appeal suspension via GitHub support

### No Email Returned

**Cause**: User hasn't verified email or made email private.

**Solution**:

1. Request `user:email` scope
2. Fetch `/user/emails` endpoint
3. Filter for verified emails only
4. Ask user to verify email if none found

---

## Security Best Practices

### Protect Client Secret

- ✅ Store in environment variables only
- ✅ Never commit to Git
- ✅ Never expose in frontend
- ✅ Use different secrets for dev/prod

### Reset Client Secret

If your secret is exposed:

1. Go to OAuth app settings
2. Click **Regenerate client secret**
3. Confirm regeneration
4. Update `.env` files
5. Redeploy applications

**Note**: Old secret stops working immediately.

### Validate State Parameter

Prevent CSRF attacks:

```typescript
// Generate random state
const state = crypto.randomBytes(32).toString('hex');

// Store in session
session.oauthState = state;

// Add to authorization URL
authUrl.searchParams.append('state', state);

// Validate on callback
if (callbackState !== session.oauthState) {
  throw new Error('Invalid state parameter');
}
```

### Use HTTPS in Production

- ✅ Callback URL must use HTTPS
- ✅ Never send tokens over HTTP
- ✅ Use secure cookies for sessions

### Limit Scopes

- ✅ Request minimum necessary scopes
- ✅ Don't request `repo` access for basic auth
- ✅ Explain why each scope is needed

---

## Advanced Configuration

### Allow Sign-Up via GitHub

Allow new users to register using GitHub:

```typescript
// Check if user exists
let user = await this.userService.findByGitHubId(githubId);

if (!user) {
  // Create new user from GitHub profile
  user = await this.userService.create({
    githubId,
    email: primaryEmail,
    name: githubUser.name || githubUser.login,
    avatar: githubUser.avatar_url,
    emailVerified: true, // GitHub emails are verified
  });
}
```

### Link GitHub to Existing Account

Allow logged-in users to link GitHub:

```typescript
@UseGuards(JwtAuthGuard)
@Post('user/link-github')
async linkGitHub(@User() user, @Body() { code }) {
  // Exchange code for access token
  const { access_token } = await this.getAccessToken(code);

  // Get GitHub user info
  const githubUser = await this.getGitHubUser(access_token);

  // Link to existing user
  await this.userService.update(user.id, {
    githubId: githubUser.id,
    githubAccessToken: access_token,
  });

  return { success: true };
}
```

### Sync GitHub Profile

Keep user profile updated with GitHub:

```typescript
@Cron('0 0 * * *') // Daily at midnight
async syncGitHubProfiles() {
  const users = await this.userService.findWithGitHub();

  for (const user of users) {
    try {
      const githubUser = await this.getGitHubUser(user.githubAccessToken);

      await this.userService.update(user.id, {
        name: githubUser.name,
        avatar: githubUser.avatar_url,
        bio: githubUser.bio,
      });
    } catch (error) {
      // Token expired or revoked
      console.error(`Failed to sync user ${user.id}`);
    }
  }
}
```

### Refresh Access Tokens

GitHub access tokens don't expire, but can be revoked.

**Check if token is valid**:

```typescript
const response = await fetch('https://api.github.com/user', {
  headers: {
    Authorization: `token ${accessToken}`,
  },
});

if (response.status === 401) {
  // Token is invalid, user must re-authorize
  throw new UnauthorizedException('GitHub token expired');
}
```

---

## GitHub API

### Get User Profile

```typescript
const response = await fetch('https://api.github.com/user', {
  headers: {
    Authorization: `token ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  },
});

const user = await response.json();
```

Response:

```json
{
  "login": "username",
  "id": 12345678,
  "name": "John Doe",
  "email": "user@example.com",
  "avatar_url": "https://avatars.githubusercontent.com/u/12345678",
  "bio": "Developer",
  "location": "San Francisco",
  "blog": "https://example.com",
  "twitter_username": "johndoe",
  "public_repos": 42,
  "followers": 100,
  "following": 50
}
```

### Get User Repositories

```typescript
const response = await fetch('https://api.github.com/user/repos', {
  headers: {
    Authorization: `token ${accessToken}`,
    Accept: 'application/vnd.github.v3+json',
  },
});

const repos = await response.json();
```

### Search Users

```typescript
const response = await fetch(`https://api.github.com/search/users?q=${query}`, {
  headers: {
    Accept: 'application/vnd.github.v3+json',
  },
});
```

---

## Rate Limits

### Authenticated Requests

- **Rate Limit**: 5,000 requests per hour
- **Remaining**: Check `X-RateLimit-Remaining` header
- **Reset Time**: Check `X-RateLimit-Reset` header

### Unauthenticated Requests

- **Rate Limit**: 60 requests per hour
- Based on IP address

### Check Rate Limit

```typescript
const response = await fetch('https://api.github.com/rate_limit', {
  headers: {
    Authorization: `token ${accessToken}`,
  },
});

const rateLimit = await response.json();
console.log(rateLimit.resources.core);
```

Response:

```json
{
  "limit": 5000,
  "remaining": 4999,
  "reset": 1620000000,
  "used": 1
}
```

### Handle Rate Limits

```typescript
if (response.status === 403) {
  const resetTime = response.headers.get('X-RateLimit-Reset');
  const waitTime = resetTime * 1000 - Date.now();

  throw new Error(`Rate limit exceeded. Try again in ${waitTime}ms`);
}
```

---

## Multiple Environments

GitHub allows only ONE callback URL per app.

### Solution 1: Multiple OAuth Apps

Create separate apps for each environment:

- **Development**: `auth-boilerplate-dev`
- **Staging**: `auth-boilerplate-staging`
- **Production**: `auth-boilerplate-prod`

Each with their own Client ID and Secret.

### Solution 2: Dynamic Callback URL (Not Recommended)

Use a proxy that redirects to actual callback:

```
GitHub → https://proxy.com/callback → http://localhost:3000/api/auth/oauth/callback
```

**Drawback**: Adds complexity and potential security risks.

---

## GitHub Apps vs OAuth Apps

### OAuth Apps (What We Use)

- User-to-server authentication
- Access user's resources
- Simpler setup
- Best for: Social login, user-facing features

### GitHub Apps

- App-to-server authentication
- Access organization resources
- More granular permissions
- Best for: CI/CD, bots, integrations

**Recommendation**: Use OAuth Apps for authentication, GitHub Apps for automation.

---

## Monitoring & Analytics

### Track OAuth Conversions

```typescript
// After successful GitHub login
analytics.track('sign_up', {
  method: 'GitHub',
  userId: user.id,
});
```

### Monitor Failed Authorizations

```typescript
if (error.message === 'User denied authorization') {
  analytics.track('oauth_denied', {
    provider: 'GitHub',
  });
}
```

---

## Resources

- [GitHub OAuth Documentation](https://docs.github.com/en/developers/apps/building-oauth-apps)
- [GitHub REST API](https://docs.github.com/en/rest)
- [OAuth 2.0 Specification](https://datatracker.ietf.org/doc/html/rfc6749)
- [GitHub Developer Community](https://github.community/c/github-api-development-and-support)

---

## Support

For GitHub OAuth issues:

- [GitHub Support](https://support.github.com/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/github-oauth)
- [GitHub Community Forum](https://github.community/)
