# Facebook OAuth Setup Guide

This guide explains how to set up Facebook Login for social authentication in your application.

## 📚 Related Documentation

- **Permissions Guide**: See `docs/facebook-oauth-permissions.md` for detailed information about:
  - What permissions the app requests (`email`, `public_profile`)
  - Why profile pictures DON'T require `user_photos` permission
  - App Review requirements (spoiler: none needed for basic login)
  - What users see during OAuth authorization

## Overview

Facebook Login allows users to sign in with their Facebook account. The application implements OAuth 2.0 for secure authentication.

**User Flow**:

1. User clicks "Sign in with Facebook"
2. Redirects to Facebook login
3. User authorizes the app
4. Facebook redirects back with authorization code
5. Backend exchanges code for access token and user info
6. User is logged in

---

## Step 1: Create Facebook Developer Account

1. Go to [Facebook for Developers](https://developers.facebook.com/)
2. Click **Get Started** (top right)
3. Log in with your Facebook account
4. Complete registration:
   - Accept Facebook Platform Terms
   - Verify email if needed
5. You'll be redirected to the dashboard

---

## Step 2: Create Facebook App

1. Click **My Apps** → **Create App**
2. Select use case:
   - **Use case**: Other
   - Click **Next**
3. Select app type:
   - **App type**: Consumer
   - Click **Next**
4. Enter app details:
   - **App name**: `Auth Boilerplate` (or your app name)
   - **App contact email**: Your support email
   - **Business account**: (optional) Select if you have one
5. Click **Create App**
6. Complete security check (CAPTCHA)
7. You'll be redirected to app dashboard

---

## Step 3: Configure Facebook Login

### 1. Add Facebook Login Product

1. In app dashboard, find **Add a Product** section
2. Locate **Facebook Login**
3. Click **Set Up**
4. Select platform:
   - **Web** (for web applications)
5. Click **Next**

### 2. Configure Site URL

1. Enter your site URL:
   - Development: `http://localhost:3000`
   - Production: `https://yourdomain.com`
2. Click **Save**
3. Click **Continue**

### 3. Configure OAuth Settings

1. Navigate to **Facebook Login** → **Settings** (left sidebar)
2. Configure OAuth redirect URIs:

**Valid OAuth Redirect URIs**:

```
http://localhost:5000/api/auth/oauth/facebook/callback
https://yourdomain.com/api/auth/oauth/facebook/callback
```

**Important**:

- The callback URL must match `/api/auth/oauth/facebook/callback`
- Add both development and production URLs
- Must match exactly with backend `.env` configuration

3. Configure other settings:
   - **Login with the JavaScript SDK**: No (we use backend OAuth)
   - **Use Strict Mode for Redirect URIs**: Yes (recommended)
   - **Enforce HTTPS**: Yes (production only)
4. Click **Save Changes**

---

## Step 4: Configure App Settings

### 1. Basic Settings

1. Navigate to **Settings** → **Basic** (left sidebar)
2. Note your credentials:
   - **App ID**: Your application ID (numeric)
   - **App Secret**: Click **Show** to reveal (keep secure!)
3. Configure app details:
   - **App Domains**: Add your domain(s):
     ```
     localhost
     yourdomain.com
     ```
   - **Privacy Policy URL**: `https://yourdomain.com/privacy`
   - **Terms of Service URL**: `https://yourdomain.com/terms`
   - **User Data Deletion**: Callback URL or instructions
4. Click **Save Changes**

### 2. App Icon (Optional but Recommended)

1. Scroll to **App Icon**
2. Upload 1024x1024px icon
3. This appears on Facebook login dialog

---

## Step 5: Verify Permissions Configuration

The app requests only default permissions that **DO NOT require App Review**.

### Required Permissions (Default - No Review Needed)

| Permission       | What It Provides                   | Used For                                       |
| ---------------- | ---------------------------------- | ---------------------------------------------- |
| `email`          | User's email address               | Account creation and identification (REQUIRED) |
| `public_profile` | Name, profile picture, Facebook ID | User profile sync                              |

**Important Notes**:

- ✅ These are **default permissions** - automatically available when you add "Facebook Login" product
- ✅ **Profile pictures** are included in `public_profile` permission
- ❌ **NO need** for `user_photos` permission (that's for photo albums, not profile pictures)
- ✅ No Facebook App Review required for basic login

### Verify Permissions Are Active

1. Navigate to **App Review** → **Permissions and Features**
2. You should see:
   - ✅ **email** - Status: Available (Default)
   - ✅ **public_profile** - Status: Available (Default)
3. No action needed - these are automatically approved

### What Users See During Login

When users click "Sign in with Facebook", they see:

```
"MERN Auth Boilerplate wants to access your Facebook information"

✓ Public profile (Your name and profile picture)
✓ Email address (Your primary email address)

[Cancel]  [Continue as John Doe]
```

### Advanced Permissions (NOT Used by This App)

The following permissions are **NOT requested** by the app:

- ❌ `user_photos` - Access to user's photo albums (not needed, profile picture is in `public_profile`)
- ❌ `user_birthday` - User's birthday
- ❌ `user_gender` - User's gender
- ❌ `user_location` - User's location
- ❌ `user_friends` - User's friends list

**Note**: Advanced permissions would require Facebook App Review before going live.

**For detailed information about permissions**, see: `docs/facebook-oauth-permissions.md`

---

## Step 6: Configure Environment Variables

### Backend Configuration

Add to `backend/.env`:

```bash
# Facebook OAuth Configuration
OAUTH_FACEBOOK_CLIENT_ID=your-app-id-here
OAUTH_FACEBOOK_CLIENT_SECRET=your-app-secret-here
OAUTH_FACEBOOK_CALLBACK_URL=http://localhost:5000/api/auth/oauth/facebook/callback

# Production override
# OAUTH_FACEBOOK_CALLBACK_URL=https://yourdomain.com/api/auth/oauth/facebook/callback
```

**Important**:

- Use `OAUTH_FACEBOOK_CLIENT_ID` (not `FACEBOOK_APP_ID`)
- Callback URL must match `/api/auth/oauth/facebook/callback`
- Must match exactly with Facebook Developer Console redirect URI
- App Secret must never be committed to version control

### Frontend Configuration

**No frontend environment variables needed!**

The frontend automatically detects enabled OAuth providers by calling:

```
GET /api/auth/oauth/providers
```

When Facebook is configured in backend, the Facebook button appears automatically.

---

## Step 7: Test Facebook Login

### Switch to Development Mode

Before testing, ensure your app is in Development mode:

1. Toggle **App Mode** to **Development** (top of dashboard)
2. In Development mode:
   - Only app developers and testers can use Facebook Login
   - No public users can authenticate

### Add Test Users

1. Navigate to **Roles** → **Test Users**
2. Click **Add Test User**
3. Create test accounts
4. You can log in with these accounts for testing

### Manual Testing

1. Start your backend:

   ```bash
   cd backend
   npm run start:dev
   ```

2. Start your frontend:

   ```bash
   cd frontend
   npm run dev
   ```

3. Navigate to: `http://localhost:3000/auth/login`

4. Click **Sign in with Facebook** button

5. Log in with a test user or developer account

6. Authorize the application

7. You should be redirected back and logged in

### Manual Testing

Open the start endpoint directly in your browser:

```
http://localhost:5000/api/auth/oauth/facebook/start?redirect=/dashboard
```

The browser receives an HTTP 302 redirect with the signed state cookie and loads Facebook's login dialog.

---

## Step 8: Go Live (Production)

Once testing is complete, publish your app:

### Prerequisites

1. **Privacy Policy**: Must be publicly accessible
2. **Data Deletion**: Implement user data deletion callback or instructions
3. **App Icon**: 1024x1024px icon uploaded
4. **App Category**: Select appropriate category
5. **Business Verification**: May be required for certain permissions

### Publishing Steps

1. Navigate to **Settings** → **Basic**
2. Select **App Category**:
   - Business and Pages
   - Education
   - Entertainment
   - Finance
   - Utilities
   - Other
3. Switch **App Mode** from **Development** to **Live**
4. Confirm the change

**Warning**: Once live, all configuration changes require review.

---

## Troubleshooting

### Error: "URL Blocked: This redirect failed because the redirect URI is not whitelisted"

**Cause**: Redirect URI not added to OAuth settings.

**Solution**:

1. Go to **Facebook Login** → **Settings**
2. Add redirect URI to **Valid OAuth Redirect URIs**
3. Format: `http://localhost:3000/api/auth/oauth/callback`
4. Click **Save Changes**

### Error: "App Not Set Up: This app is still in development mode"

**Cause**: App is in Development mode and user is not a tester.

**Solution**:

1. Add user as test user (**Roles** → **Test Users**)
2. Or switch app to **Live** mode (production only)

### Error: "Invalid App ID"

**Cause**: App ID doesn't match or is incorrect.

**Solution**:

1. Copy App ID from **Settings** → **Basic**
2. Update `FACEBOOK_APP_ID` in `.env`
3. Restart servers

### Error: "Invalid OAuth access token"

**Cause**: Access token expired or invalid.

**Solution**:

1. Verify `FACEBOOK_APP_SECRET` is correct
2. Check token hasn't expired (short-lived tokens expire in 1-2 hours)
3. Implement token refresh mechanism

### Error: "Missing required parameter: email"

**Cause**: User denied email permission or email not available.

**Solution**:

1. Check if `email` scope is requested
2. Handle cases where email is not provided
3. Some Facebook accounts don't have email addresses

---

## Security Best Practices

### Protect App Secret

- ✅ **Never expose in frontend code**
- ✅ Store in environment variables only
- ✅ Never commit to version control
- ✅ Reset if accidentally exposed

### Reset App Secret

If your secret is compromised:

1. Go to **Settings** → **Basic**
2. Click **Reset App Secret**
3. Confirm reset
4. Update `.env` files
5. Redeploy applications

### Validate Redirect URIs

- ✅ Whitelist exact redirect URIs
- ✅ Use HTTPS in production
- ✅ Enable **Use Strict Mode for Redirect URIs**

### Limit Permissions

- ✅ Request minimum necessary permissions
- ✅ Only request `public_profile` and `email` for basic auth
- ✅ Additional permissions require app review

### Token Security

- ✅ Use short-lived access tokens
- ✅ Implement token refresh
- ✅ Store tokens securely (httpOnly cookies)
- ✅ Invalidate tokens on logout

---

## Advanced Configuration

### Request Additional Fields

Request more profile fields:

```typescript
const fields = ['id', 'name', 'email', 'picture.width(200).height(200)'];
const graphUrl = `https://graph.facebook.com/me?fields=${fields.join(',')}&access_token=${accessToken}`;
```

### Long-Lived Access Tokens

Exchange short-lived token for long-lived (60 days):

```typescript
const url = new URL('https://graph.facebook.com/oauth/access_token');
url.searchParams.append('grant_type', 'fb_exchange_token');
url.searchParams.append('client_id', process.env.FACEBOOK_APP_ID);
url.searchParams.append('client_secret', process.env.FACEBOOK_APP_SECRET);
url.searchParams.append('fb_exchange_token', shortLivedToken);

const response = await fetch(url);
const data = await response.json();
const longLivedToken = data.access_token;
```

### Page Access Tokens

For managing Facebook Pages:

1. Request `manage_pages` permission (requires review)
2. Get page access tokens via Graph API
3. Use for posting, reading insights, etc.

### Webhooks

Receive real-time updates:

1. Navigate to **Webhooks** → **Page**
2. Add webhook URL: `https://yourdomain.com/api/webhooks/facebook`
3. Subscribe to events (feed, messages, etc.)
4. Implement verification endpoint

---

## Facebook Graph API

### Get User Info

```typescript
const response = await fetch(
  `https://graph.facebook.com/me?fields=id,name,email,picture&access_token=${accessToken}`,
);
const user = await response.json();
```

### Get Profile Picture

```typescript
const pictureUrl = `https://graph.facebook.com/${userId}/picture?width=200&height=200&access_token=${accessToken}`;
```

### Debug Access Token

Verify token validity:

```typescript
const debugUrl = `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appToken}`;
```

**App Token**: `{APP_ID}|{APP_SECRET}`

---

## Rate Limits

### API Rate Limits

- **Per app**: 200 calls per user per hour
- **Per user**: Varies by API endpoint
- **Page insights**: 4,800 calls per 24 hours

### Exceeding Limits

If you hit rate limits:

1. Implement exponential backoff
2. Cache responses when possible
3. Request rate limit increase via support

---

## Data Privacy Compliance

### GDPR Requirements

If serving EU users:

1. **Data Minimization**: Only request necessary permissions
2. **User Consent**: Clear opt-in for data collection
3. **Data Deletion**: Implement user data deletion
4. **Privacy Policy**: Detail data usage

### Data Deletion Callback

Implement endpoint to handle deletion requests:

```typescript
@Post('webhooks/facebook/data-deletion')
async handleDataDeletion(@Body() payload: FacebookDeletionPayload) {
  const userId = payload.user_id;

  // Delete user data from your database
  await this.userService.deleteByFacebookId(userId);

  return {
    url: `https://yourdomain.com/deletion-confirmation/${userId}`,
    confirmation_code: generateConfirmationCode(),
  };
}
```

Add callback URL in **Settings** → **Basic** → **User Data Deletion**.

---

## Migration from JavaScript SDK

If migrating from Facebook JavaScript SDK:

### Legacy Code (Client-Side OAuth)

```javascript
// Old: Client-side authentication
FB.login((response) => {
  const accessToken = response.authResponse.accessToken;
  // Send token to backend
});
```

### New Code (Server-Side OAuth)

```javascript
// New: Server-side OAuth flow
window.location.href = authorizationUrl;
```

**Benefits of Server-Side**:

- More secure (app secret never exposed)
- Better token management
- Easier to audit

---

## Monitoring & Analytics

### App Analytics

1. Navigate to **Analytics** → **Overview**
2. View metrics:
   - Active users
   - New users
   - Login attempts
   - API calls

### Facebook Business Manager Integration

Link to Business Manager for advanced features:

1. Create Business Manager account
2. Link app to business
3. Access ads, analytics, and insights

---

## Resources

- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
- [Graph API Reference](https://developers.facebook.com/docs/graph-api)
- [Facebook Developer Community](https://developers.facebook.com/community/)
- [OAuth Best Practices](https://developers.facebook.com/docs/facebook-login/security/)

---

## Support

For Facebook OAuth issues:

- [Facebook Developer Support](https://developers.facebook.com/support/)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/facebook-oauth)
- [Facebook Developers Community Forum](https://developers.facebook.com/community/)
