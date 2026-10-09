# Microsoft OAuth setup

Sign in with a Microsoft account or an Entra ID (Azure AD) work account. The
backend uses the OpenID Connect endpoints of the Microsoft identity platform
with PKCE, and verifies the id_token against the tenant JWKS.

## Register the application

1. Open the [Microsoft Entra admin center](https://entra.microsoft.com/) and go
   to Identity, Applications, App registrations.
2. Click New registration.
3. Name the app whatever your users should see on the consent screen.
4. Under Supported account types, pick who may sign in:
   - Accounts in this organizational directory only, for one tenant.
   - Accounts in any organizational directory and personal Microsoft accounts,
     which matches `OAUTH_MICROSOFT_TENANT=common`.
5. Under Redirect URI, choose Web and enter
   `https://<api-domain>/api/auth/oauth/microsoft/callback`.
6. Register the app, then copy the Application (client) ID and the Directory
   (tenant) ID from the overview page.

## Create a client secret

1. Open Certificates & secrets, then Client secrets, then New client secret.
2. Copy the Value column right away. It is shown once.
3. Note the expiry date. Entra secrets expire, 24 months at most, and sign-in
   breaks the day they do.

## Permissions

The default delegated permissions for a new registration (`User.Read`) already
cover `openid`, `profile` and `email`. No admin consent is needed for those. If
your tenant restricts user consent, an admin has to grant consent once from the
API permissions page.

## Environment variables

```bash
OAUTH_MICROSOFT_CLIENT_ID=00000000-0000-0000-0000-000000000000
OAUTH_MICROSOFT_CLIENT_SECRET=the-secret-value-not-the-secret-id
OAUTH_MICROSOFT_CALLBACK_URL=https://<api-domain>/api/auth/oauth/microsoft/callback
OAUTH_MICROSOFT_TENANT=common
```

`OAUTH_MICROSOFT_TENANT` defaults to `common`. Set it to your directory (tenant)
ID to keep sign-in inside one organisation, or use `organizations` for work and
school accounts only, or `consumers` for personal accounts only.

The provider turns on once the client id and the client secret are both present.

## Redirect URI

`https://<api-domain>/api/auth/oauth/microsoft/callback`

Entra matches the redirect URI exactly, including the scheme, the port and the
trailing path. Register one URI per environment; a registration can hold several.
For local work, `http://localhost:5000/api/auth/oauth/microsoft/callback` is
accepted, because Entra allows http on localhost.

## Gotchas

**The email claim is not always verified.** Entra will hand out an `email` claim
that nobody checked, for example from an unverified profile attribute in a
personal account. The strategy trusts the address only when the token carries
`xms_edov: true`, or when the sign-in name (`preferred_username`) is the same
address. Otherwise the account is treated as unverified and the existing
unverified-email policy applies.

`xms_edov` is not in the Token configuration claim picker. It is requested as an
optional ID token claim through the app manifest editor. See Microsoft's
[optional claims reference](https://learn.microsoft.com/entra/identity-platform/optional-claims-reference)
for the exact manifest entry, which changes between manifest schema versions.

**The issuer changes per tenant.** With `common`, the token issuer is
`https://login.microsoftonline.com/<tid>/v2.0`, where `<tid>` is the signing
tenant. The strategy fills the template with the token's own `tid` claim and
compares. If you need to accept only one tenant, set `OAUTH_MICROSOFT_TENANT` to
that tenant id; Entra then refuses tokens from anywhere else.

**Use `oid`, not `sub`.** The `sub` claim is different for every application, so
it cannot be matched across apps. The strategy stores `oid`, the user's object
id in the directory, and falls back to `sub` when `oid` is absent.

**Copy the secret Value, not the Secret ID.** They sit next to each other in the
portal and only one of them works.

**The Graph photo needs a token.** `userinfo` returns a `picture` URL that only
answers with a bearer token, so no avatar is stored for Microsoft accounts.
