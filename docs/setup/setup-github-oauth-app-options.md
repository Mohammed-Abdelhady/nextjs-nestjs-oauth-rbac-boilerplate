# GitHub OAuth app options and monitoring

[Guide overview](setup-github-oauth.md)

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
