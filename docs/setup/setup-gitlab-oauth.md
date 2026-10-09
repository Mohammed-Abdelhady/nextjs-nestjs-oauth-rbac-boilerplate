# GitLab OAuth setup

Sign in with GitLab through OpenID Connect, on gitlab.com or on a self-managed
instance. The backend verifies the id_token against the instance's JWKS and
reads the profile from its userinfo endpoint.

## Register the application

On gitlab.com, an application can live on a user, a group or an instance. A
group application is the usual choice for a team.

1. Open [User settings, Applications](https://gitlab.com/-/user_settings/applications),
   or Settings, Applications on the group.
2. Click Add new application.
3. Name it and set the Redirect URI to
   `https://<api-domain>/api/auth/oauth/gitlab/callback`.
4. Leave Confidential ticked. The backend keeps the secret server side.
5. Tick the scopes `openid`, `profile`, `email` and `read_user`.
6. Save. Copy the Application ID and the Secret; the secret is shown once.

On a self-managed instance the same screens live under `/-/user_settings/applications`
or, for an instance-wide application, under Admin, Applications.

## Scopes

The strategy requests `openid profile email read_user`. `openid` turns on the
OIDC endpoints, `profile` and `email` fill the userinfo response, and
`read_user` is what GitLab wants before it answers for the account. Tick all
four on the application or the authorize call comes back with
`invalid_scope`.

## Environment variables

```bash
OAUTH_GITLAB_CLIENT_ID=your-application-id
OAUTH_GITLAB_CLIENT_SECRET=your-application-secret
OAUTH_GITLAB_CALLBACK_URL=https://<api-domain>/api/auth/oauth/gitlab/callback
# Only for a self-managed instance
OAUTH_GITLAB_BASE_URL=https://gitlab.example.com
```

The provider turns on once the id and the secret are present.
`OAUTH_GITLAB_BASE_URL` defaults to `https://gitlab.com`.

## Redirect URI

`https://<api-domain>/api/auth/oauth/gitlab/callback`

GitLab compares the URI exactly. Several can be listed on one application, one
per line, so a single application covers local and deployed environments;
`http://localhost:5000/api/auth/oauth/gitlab/callback` is accepted for local
work.

## Self-managed instances

Every endpoint hangs off the base URL, so pointing `OAUTH_GITLAB_BASE_URL` at
your host is the whole configuration:

| Endpoint  | Path                          |
| --------- | ----------------------------- |
| Authorize | `{base}/oauth/authorize`      |
| Token     | `{base}/oauth/token`          |
| Userinfo  | `{base}/oauth/userinfo`       |
| JWKS      | `{base}/oauth/discovery/keys` |
| Issuer    | `{base}`                      |

The issuer is checked against that same base URL, so an id_token minted by
gitlab.com is refused on a deployment configured for your own host, and the
other way round. A trailing slash on the base URL is dropped.

## Gotchas

**The provider id is the subject, not the username.** GitLab usernames change;
`sub` does not. The strategy stores `sub`, so a rename keeps the account linked.

**The subject is per instance.** Moving a deployment from gitlab.com to a
self-managed instance means new subjects for everyone, so existing links stop
matching. Users land on the email branch instead and get linked by address.

**Instance-wide applications need a trusted flag for silent sign-in.** Without
it every user sees the authorization page once. That is the normal flow here,
so nothing breaks; it is only the extra click.

**Old instances may not publish the OIDC endpoints.** An instance too old for
`openid` fails the authorize call with `invalid_scope`. Check
`{base}/.well-known/openid-configuration` before blaming the configuration, and
upgrade the instance rather than working around it.
