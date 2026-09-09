# X OAuth setup

Sign in with an X account. Plain OAuth 2.0 with PKCE, no OpenID Connect, so
there is no id_token to verify. The signed state cookie and the PKCE verifier
carry the whole defence.

## Register the application

1. Open the [X Developer Portal](https://developer.x.com/en/portal/dashboard)
   and create a project, then an app inside it.
2. Open the app's User authentication settings and click Set up.
3. Turn App permissions to Read.
4. Set Type of App to Web App, Automated App or Bot. That is the confidential
   client, which is the one that gets a client secret.
5. Under App info, set the Callback URI to
   `https://<api-domain>/api/auth/oauth/x/callback` and fill in the website
   URL.
6. Save, then copy the OAuth 2.0 Client ID and Client Secret from the Keys and
   tokens tab. The secret is shown once.

## Request the email scope

`users.email` is not on by default.

1. Open the app's settings and find the User authentication settings section.
2. Request access to the email scope and give the reason X asks for.
3. Wait for it to be granted on the app.

Without `users.email` the token is issued but `confirmed_email` never comes
back, and the login is refused with `OAUTH_EMAIL_UNVERIFIED`.

## Scopes

The strategy requests `tweet.read users.read users.email offline.access`.
`users.read` is what makes `GET /2/users/me` answer at all, and X requires
`tweet.read` alongside it. `users.email` adds the address. `offline.access`
returns a refresh token.

## Environment variables

```bash
OAUTH_X_CLIENT_ID=your-oauth2-client-id
OAUTH_X_CLIENT_SECRET=your-oauth2-client-secret
OAUTH_X_CALLBACK_URL=https://<api-domain>/api/auth/oauth/x/callback
```

The provider turns on once both values are present.

## Redirect URI

`https://<api-domain>/api/auth/oauth/x/callback`

X compares the URI exactly, including the scheme and any trailing slash.
Several can be listed on one app, so `http://localhost:5000/api/auth/oauth/x/callback`
covers local work.

## Gotchas

**Authorization codes expire in 30 seconds.** The exchange runs inside the
callback request for that reason. Do not queue it, retry it later or hand the
code to another service; a code that arrives a minute late is already dead and
comes back as `OAUTH_CODE_INVALID`.

**PKCE is mandatory.** X refuses an authorize request without a code challenge,
so the strategy refuses to build one. If a login fails with
`OAUTH_STATE_INVALID` before the browser ever leaves, the state cookie was
dropped and the verifier went with it.

**The token endpoint wants HTTP Basic.** A confidential client authenticates
with the id and secret in the `Authorization` header, not in the body. Sending
them in the body returns `401 unauthorized_client`.

**The address comes from `confirmed_email`.** X only fills it for an address
the account has confirmed, so its absence means there is nothing to trust
rather than nothing to read. Those logins are refused rather than let through
as unverified.

**The client id and the API key are different things.** The OAuth 2.0 Client ID
and Client Secret sit under Keys and tokens, separate from the OAuth 1.0a API
Key and Secret. Using the 1.0a pair here fails at the token exchange.
