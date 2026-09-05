# Twitch OAuth setup

Sign in with a Twitch account through OpenID Connect. The backend verifies the
id_token against Twitch's JWKS and reads the profile from the userinfo
endpoint.

## Register the application

1. Open the [Twitch Developer Console](https://dev.twitch.tv/console/apps) and
   click Register Your Application. The account needs two-factor turned on
   before it can register anything.
2. Name it. Names are unique across all of Twitch, so a generic one is likely
   taken.
3. Set the OAuth Redirect URL to
   `https://<api-domain>/api/auth/oauth/twitch/callback`.
4. Pick a category and create the application.
5. Open it again, copy the Client ID, then click New Secret and copy that. The
   secret is shown once.

## Scopes

The strategy requests `openid user:read:email`. `openid` turns on the OIDC
endpoints and `user:read:email` is what makes the address available at all.

Asking for the scope is not enough on its own. Twitch leaves email, its
verification flag, the login name and the avatar out of the response unless
they are named in the `claims` parameter, so the authorize URL carries:

```json
{
  "userinfo": {
    "email": null,
    "email_verified": null,
    "preferred_username": null,
    "picture": null
  }
}
```

Without it the login fails with a profile error saying no email came back.

## Environment variables

```bash
OAUTH_TWITCH_CLIENT_ID=your-client-id
OAUTH_TWITCH_CLIENT_SECRET=your-client-secret
OAUTH_TWITCH_CALLBACK_URL=https://<api-domain>/api/auth/oauth/twitch/callback
```

The provider turns on once both values are present.

## Redirect URI

`https://<api-domain>/api/auth/oauth/twitch/callback`

Twitch compares the URL exactly. One application holds several, so local and
deployed environments can share it;
`http://localhost:5000/api/auth/oauth/twitch/callback` is accepted, and
localhost is the only host Twitch allows over plain HTTP.

## Gotchas

**No PKCE.** Twitch's authorize endpoint takes no code challenge, so the
strategy declares `supportsPkce: false`. The signed state cookie and the
id_token nonce are what protect the flow.

**Client secrets are single use to copy.** New Secret invalidates the old one
immediately, so redeploy with the new value in the same change.

**Unverified addresses come through.** An account that has not confirmed its
address returns `email_verified: false`, which the strategy passes on as
unverified. The usual unverified-email policy decides what happens next.

**The name comes from `preferred_username`.** That is the only name claim the
strategy asks for, so whatever Twitch puts there is what the account is called
here. There is no separate lookup against the Helix API.
