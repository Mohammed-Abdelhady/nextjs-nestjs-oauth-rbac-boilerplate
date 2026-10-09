# GitHub OAuth troubleshooting and security

[Guide overview](setup-github-oauth.md)

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
