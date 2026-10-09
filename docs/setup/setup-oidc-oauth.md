# Generic OpenID Connect setup

One provider for any OpenID Connect issuer: Keycloak, Auth0, Okta, Authentik,
Zitadel, an Entra ID tenant, a company SSO. Everything comes from environment
variables, so no code changes when the issuer does.

## What the issuer needs

A confidential client with:

- the authorization code grant,
- the redirect URI `https://<api-domain>/api/auth/oauth/<provider-id>/callback`,
- the scopes `openid`, `profile` and `email`,
- an id_token signed with an asymmetric algorithm (RS, PS or ES). Symmetric
  algorithms and `none` are refused.

`<provider-id>` is `OAUTH_OIDC_PROVIDER_ID`, which defaults to `oidc`.

## Environment variables

```bash
OAUTH_OIDC_ISSUER=https://sso.example.com
OAUTH_OIDC_CLIENT_ID=your-client-id
OAUTH_OIDC_CLIENT_SECRET=your-client-secret
OAUTH_OIDC_CALLBACK_URL=https://<api-domain>/api/auth/oauth/oidc/callback
```

Optional:

```bash
# Route segment and the name stored on linked accounts. Default: oidc
OAUTH_OIDC_PROVIDER_ID=keycloak
# Name shown in the sign-in list. Default: Single sign-on
OAUTH_OIDC_DISPLAY_NAME=Company account
# Default: openid profile email
OAUTH_OIDC_SCOPES=openid profile email groups
```

The provider turns on once the client id, the secret, the issuer and a set of
endpoints are all in place.

## Discovery

At startup the backend reads
`{OAUTH_OIDC_ISSUER}/.well-known/openid-configuration` once and holds the
result for the life of the process. From it come the authorize, token, userinfo
and JWKS URLs, whether PKCE with S256 is supported, and which signing
algorithms to accept.

The document's own `issuer` field has to match `OAUTH_OIDC_ISSUER`, ignoring a
trailing slash. A document that names a different issuer is refused.

If the issuer is unreachable at startup the provider stays off and a warning is
logged. The application boots as usual and every other sign-in method keeps
working. There is no retry: restart the backend once the issuer is reachable.

## Endpoints by hand

For an issuer that publishes no discovery document, set all four:

```bash
OAUTH_OIDC_AUTHORIZATION_URL=https://sso.example.com/authorize
OAUTH_OIDC_TOKEN_URL=https://sso.example.com/token
OAUTH_OIDC_USERINFO_URL=https://sso.example.com/userinfo
OAUTH_OIDC_JWKS_URL=https://sso.example.com/jwks
```

With all four present the startup request is skipped entirely, so the provider
is available even when the issuer is down at boot. `OAUTH_OIDC_ISSUER` is still
required: it is what id_tokens are checked against.

Setting only some of them keeps discovery on and lets the ones you set override
what the document says. That is the way to point at an internal token endpoint
while still reading the rest from the public document.

## Redirect URI

`https://<api-domain>/api/auth/oauth/<provider-id>/callback`

Changing `OAUTH_OIDC_PROVIDER_ID` changes this URL, so the entry registered
with the issuer has to change with it.

## Gotchas

**PKCE follows the document.** The code challenge is only sent when the issuer
lists `S256` under `code_challenge_methods_supported`. With endpoints set by
hand there is no document to read, so PKCE stays off; the signed state cookie
and the id_token nonce carry the flow. Use discovery if you want PKCE.

**Changing the provider id orphans existing links.** The id is stored on every
linked account. Renaming it from `oidc` to `keycloak` leaves the old links
pointing at a provider that no longer exists, and returning users are matched
by email instead. Pick the id before the first user signs in.

**The id cannot be one of the built-in providers.** Setting it to `google`,
`github` or any other registered id stops the boot with a clear message rather
than quietly shadowing that provider. Lowercase letters, digits and dashes
only.

**The subject has to agree.** The strategy refuses a userinfo response whose
`sub` differs from the id_token's, which catches a misrouted or mismatched
userinfo endpoint.

**Verification comes from the claims.** `email_verified` on userinfo wins, and
the id_token claim is the fallback. An issuer that sends neither is treated as
unverified, and the usual unverified-email policy decides what happens next.

**One issuer at a time.** There is a single generic provider. Two OIDC issuers
side by side means a second strategy, which is a code change.
