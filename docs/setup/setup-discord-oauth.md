# Discord OAuth setup

Sign in with a Discord account. Plain OAuth 2.0 with PKCE, no OpenID Connect.

## Register the application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications)
   and click New Application.
2. Name it and accept the developer terms.
3. Open OAuth2 in the left sidebar.
4. Under Redirects, click Add Redirect and enter
   `https://<api-domain>/api/auth/oauth/discord/callback`, then Save Changes.
5. Copy the Client ID. For the secret, click Reset Secret and copy the value it
   shows once.

The OAuth2 URL Generator on the same page is a convenience for building an
authorize link by hand. The backend builds its own, so you can ignore it.

## Scopes

The strategy requests `identify` and `email`. `identify` returns the user id,
username, display name and avatar hash; `email` adds the address and its
verification flag. Neither needs review or approval.

## Environment variables

```bash
OAUTH_DISCORD_CLIENT_ID=123456789012345678
OAUTH_DISCORD_CLIENT_SECRET=your-client-secret
OAUTH_DISCORD_CALLBACK_URL=https://<api-domain>/api/auth/oauth/discord/callback
```

The provider turns on once both the client id and the secret are present.

## Redirect URI

`https://<api-domain>/api/auth/oauth/discord/callback`

Discord compares the redirect exactly, and it has to be one of the entries in
the Redirects list. Add a separate entry for each environment;
`http://localhost:5000/api/auth/oauth/discord/callback` is accepted for local
work.

## Gotchas

**Email can be null.** An account that never confirmed an address returns
`email: null`, and the login is refused with a profile error. An account with an
unconfirmed address returns the address with `verified: false`; the strategy
passes that through as unverified and the usual unverified-email policy decides
what happens next.

**The display name is separate from the username.** Discord's newer accounts
have a unique `username` plus an optional `global_name` shown in the UI. The
strategy prefers `global_name` and falls back to `username`.

**Avatars are built from a hash.** The API returns an avatar hash, not a URL.
The strategy builds `https://cdn.discordapp.com/avatars/<user id>/<hash>.png`.
Accounts with no avatar set return `null` and get no avatar. Animated avatars
have a hash starting with `a_` and are served as `.gif`; the `.png` URL still
works and returns a still frame.

**Resetting the secret logs everyone out of the flow.** The old secret stops
working the moment you click Reset Secret, so redeploy with the new value.
