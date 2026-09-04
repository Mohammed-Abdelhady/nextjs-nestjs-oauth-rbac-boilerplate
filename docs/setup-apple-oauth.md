# Apple OAuth setup

Sign in with Apple. This one takes more setup than the other providers: Apple
has no static client secret, it posts the callback as a form instead of
redirecting with a query string, and it refuses localhost redirect URIs.

Read the whole page before you start. The pieces have to be created in order.

## What you need

A paid Apple Developer Program membership. Sign in with Apple is not available
on a free account.

## Step 1: App ID

1. Go to [Certificates, Identifiers & Profiles](https://developer.apple.com/account/resources/identifiers/list).
2. Identifiers, then the plus button, then App IDs, then App.
3. Give it a description and a bundle ID such as `com.example.app`.
4. In the capability list, tick Sign In with Apple.
5. Register.

## Step 2: Services ID

The Services ID is the client id for web sign-in. The App ID alone is not enough.

1. Identifiers, plus button, Services IDs.
2. Description and an identifier such as `com.example.web`. This string is
   `OAUTH_APPLE_CLIENT_ID`.
3. Register, then open the Services ID again and tick Sign In with Apple.
4. Click Configure:
   - Primary App ID: the App ID from step 1.
   - Domains and Subdomains: your API domain, without a scheme, for example
     `api.example.com`.
   - Return URLs: `https://<api-domain>/api/auth/oauth/apple/callback`.
5. Save, then Continue and Save on the Services ID itself.

## Step 3: Sign-in key

1. Keys, plus button.
2. Name the key and tick Sign In with Apple, then Configure and pick the primary
   App ID.
3. Continue, Register, then Download. The `.p8` file downloads once and cannot
   be downloaded again.
4. Note the Key ID shown on the page. Your Team ID is in the top right of the
   developer account, ten characters.

## Step 4: Environment variables

```bash
OAUTH_APPLE_CLIENT_ID=com.example.web
OAUTH_APPLE_CALLBACK_URL=https://<api-domain>/api/auth/oauth/apple/callback
OAUTH_APPLE_TEAM_ID=ABCDE12345
OAUTH_APPLE_KEY_ID=KEY1234567
OAUTH_APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIGT...\n-----END PRIVATE KEY-----\n
```

The private key is the contents of the `.p8` file on a single line, with every
newline written as `\n`. On macOS:

```bash
awk 'BEGIN{ORS="\\n"} {print}' AuthKey_KEY1234567.p8
```

There is no `OAUTH_APPLE_CLIENT_SECRET`. The backend signs a five minute ES256
JWT for each token request, using the team id as issuer, the Services ID as
subject and `https://appleid.apple.com` as audience. Apple caps the lifetime of
that JWT at six months.

Apple turns on once the Services ID, team id, key id and private key are all set.

## Redirect URI

`https://<api-domain>/api/auth/oauth/apple/callback`

## Gotchas

**No localhost, no http.** Apple rejects `localhost` and any non-HTTPS return
URL when you register the Services ID. To try the flow on a development machine,
put a public HTTPS tunnel in front of the API (ngrok, Cloudflare Tunnel), then
register the tunnel domain and point `OAUTH_APPLE_CALLBACK_URL` and
`OAUTH_CALLBACK_BASE_URL` at it.

**The callback is a POST.** Because scopes are requested, Apple uses
`response_mode=form_post` and posts `code`, `state`, `id_token` and sometimes
`user` to the return URL as `application/x-www-form-urlencoded`. The backend
serves `POST /api/auth/oauth/apple/callback` for exactly this. If a proxy in
front of the API only forwards GET, or strips the request body, sign-in fails
before the handler runs.

**The state cookie has to survive a cross-site POST.** The browser only sends
the OAuth state cookie on that POST when it is `SameSite=None; Secure`, which
needs HTTPS. The backend writes the cookie that way when `NODE_ENV=production`
and the provider posts its callback. Run in development over plain http and the
cookie is dropped, so the callback fails with an invalid-state error. That is
another reason Apple needs a real HTTPS host even while developing.

**The name arrives once.** Apple sends the `user` field with the name only on
the first authorization for a given Services ID. On later logins there is no
name, and there is no userinfo endpoint to ask. The backend stores the name on
that first login; if you delete the user record and sign in again, the name is
gone unless the user removes the app from
[appleid.apple.com](https://appleid.apple.com/account/manage) first.

**Private relay addresses.** A user can hide their real address, and Apple then
issues one like `abc123@privaterelay.appleid.com`. Mail to it is forwarded, but
only from sender domains registered under Sign In with Apple, Configure, Email
Sources. Unregistered senders are dropped silently.

**Client secret expiry.** Not an issue here, since the secret is signed per
request. It matters if you ever paste a hand-built secret into an env variable.
