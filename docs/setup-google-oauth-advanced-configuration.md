# Advanced Google OAuth configuration

[Guide overview](setup-google-oauth.md)

### Hosted Domain Restriction

Restrict to specific Google Workspace domain:

```typescript
authUrl.searchParams.append('hd', 'yourdomain.com');
```

**Note**: Users from other domains will see error.

### Offline Access (Refresh Tokens)

Request refresh token for offline access:

```typescript
authUrl.searchParams.append('access_type', 'offline');
authUrl.searchParams.append('prompt', 'consent');
```

**Use case**: Background sync, scheduled tasks.

### Custom Consent Prompt

Control when to show consent screen:

```typescript
// Always show consent (required for refresh tokens)
authUrl.searchParams.append('prompt', 'consent');

// Only show if needed
authUrl.searchParams.append('prompt', 'select_account');

// Never show (error if not previously authorized)
authUrl.searchParams.append('prompt', 'none');
```

---

## Google Identity Services (New)

Google recommends migrating to Google Identity Services (GIS) for better UX.

### Sign In With Google Button

Modern one-tap sign-in:

```html
<!-- Add to your login page -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<div
  id="g_id_onload"
  data-client_id="YOUR_CLIENT_ID"
  data-callback="handleCredentialResponse"
></div>

<div class="g_id_signin" data-type="standard"></div>
```

**Benefits**:

- One-tap sign-in
- No redirect required
- Better mobile experience
- Auto-logout across sites

**Implementation**: See [Google Identity Services docs](https://developers.google.com/identity/gsi/web).

---

## Quota Limits

### Free Tier Limits

- **Queries per day**: 10,000
- **Queries per 100 seconds**: 1,000
- **Queries per user per 100 seconds**: 10

### Exceeding Limits

If you hit quota limits:

1. Navigate to **APIs & Services** → **Quotas**
2. Request quota increase
3. Or optimize API usage

---

## Monitoring & Analytics

### OAuth Metrics

1. Navigate to **APIs & Services** → **Credentials**
2. Click on your OAuth client
3. View usage metrics:
   - Total authorizations
   - Active users
   - Token requests

### Google Analytics Integration

Track OAuth conversions:

```javascript
// After successful Google sign-in
gtag('event', 'sign_up', {
  method: 'Google',
});
```

---

## Migration from Legacy API

If migrating from Google+ Sign-In (deprecated):

### Legacy Code (Don't Use)

```javascript
// Old: Google Platform Library
gapi.auth2.signIn();
```

### New Code (Use This)

```javascript
// New: OAuth 2.0 with PKCE
window.location.href = authorizationUrl;
```

**Migration Guide**: [Google Sign-In Migration](https://developers.google.com/identity/sign-in/web/migration-guide)

---

## Resources

- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) - Test OAuth flows
- [Google Cloud Console](https://console.cloud.google.com/)
- [Google Identity Services](https://developers.google.com/identity/gsi/web)
- [OAuth 2.0 Best Practices](https://datatracker.ietf.org/doc/html/draft-ietf-oauth-security-topics)

---

## Support

For Google OAuth issues:

- [Google Cloud Support](https://cloud.google.com/support)
- [Stack Overflow](https://stackoverflow.com/questions/tagged/google-oauth)
- [Google Identity Platform Community](https://www.googlecloudcommunity.com/gc/Identity-Access-Management/bd-p/cloud-identity-access-management)
