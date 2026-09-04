# LinkedIn OAuth setup

Sign in with LinkedIn through OpenID Connect. The backend verifies the id_token
against LinkedIn's JWKS and reads the email from the userinfo endpoint.

## Register the application

1. Open the [LinkedIn Developer Portal](https://www.linkedin.com/developers/apps)
   and click Create app.
2. Fill in the app name, the LinkedIn Page it belongs to and the logo. An app
   has to be attached to a company Page; create one first if you have none.
3. Accept the terms and create the app.
4. Open the Verify tab and complete the page verification. An unverified app
   cannot request products.

## Enable the OpenID Connect product

This is the step people miss.

1. Open the Products tab.
2. Find "Sign In with LinkedIn using OpenID Connect" and click Request access.
3. Wait for the status to become Added. It is usually granted at once.

Without this product the authorize call fails with `unauthorized_scope_error`,
because `openid`, `profile` and `email` are not on the app.

The older "Sign In with LinkedIn" product (the v2 `r_liteprofile` API) is a
different thing and does not work with this strategy.

## Configure the redirect URL

1. Open the Auth tab.
2. Under OAuth 2.0 settings, add a redirect URL:
   `https://<api-domain>/api/auth/oauth/linkedin/callback`.
3. Copy the Client ID and the Primary Client Secret from the same tab.

## Environment variables

```bash
OAUTH_LINKEDIN_CLIENT_ID=your-client-id
OAUTH_LINKEDIN_CLIENT_SECRET=your-primary-client-secret
OAUTH_LINKEDIN_CALLBACK_URL=https://<api-domain>/api/auth/oauth/linkedin/callback
```

The provider turns on once both values are present.

## Redirect URI

`https://<api-domain>/api/auth/oauth/linkedin/callback`

LinkedIn matches the URL exactly and allows several per app, so one entry per
environment works. `http://localhost:5000/api/auth/oauth/linkedin/callback` is
accepted for local work.

## Gotchas

**No PKCE and no nonce.** LinkedIn's authorization endpoint takes neither. The
signed state cookie and the registered redirect URL are what protect the flow.
The strategy declares `supportsPkce: false` and `usesOidc: false` for that
reason, and still verifies the id_token signature, issuer, audience and expiry.

**The email comes from userinfo.** The strategy takes the provider id from the
id_token `sub` and the address and its `email_verified` flag from
`https://api.linkedin.com/v2/userinfo`. A member whose primary address is
unconfirmed comes back with `email_verified: false`.

**Client secrets expire.** LinkedIn secrets have a stated expiry, one year by
default, shown in the Auth tab. Sign-in breaks on that date. Generate a new
secret before then and redeploy.

**Scope names are the OIDC ones.** Use `openid profile email`, not the old
`r_liteprofile r_emailaddress`. Mixing the two families in one request is
rejected.
