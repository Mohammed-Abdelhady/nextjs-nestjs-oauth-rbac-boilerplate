# Slack OAuth setup

Sign in with Slack through OpenID Connect. The backend verifies the id_token
against Slack's JWKS and reads the profile from the userinfo endpoint.

This is "Sign in with Slack", which is a different thing from a bot token app.
It identifies a person; it does not install anything into a workspace.

## Register the application

1. Open [Your Apps](https://api.slack.com/apps) and click Create New App, then
   From scratch.
2. Name it and pick a development workspace.
3. Open OpenID Connect in the left sidebar under Features and turn it on.
4. Add the redirect URL `https://<api-domain>/api/auth/oauth/slack/callback`
   and save.
5. Open Basic Information and copy the Client ID and Client Secret.

## Scopes

The strategy requests `openid profile email`. They are user token scopes and
appear under the OpenID Connect page rather than under OAuth and Permissions.
There is nothing to review or approve.

## Environment variables

```bash
OAUTH_SLACK_CLIENT_ID=your-client-id
OAUTH_SLACK_CLIENT_SECRET=your-client-secret
OAUTH_SLACK_CALLBACK_URL=https://<api-domain>/api/auth/oauth/slack/callback
```

The provider turns on once both values are present.

## Redirect URI

`https://<api-domain>/api/auth/oauth/slack/callback`

Slack compares the URL exactly and allows several per app.
`http://localhost:5000/api/auth/oauth/slack/callback` is accepted for local
work.

## Gotchas

**An identity is a person inside one workspace.** Slack's `sub` carries the
team and the user, so the same person signing in from two workspaces arrives as
two provider ids. They land on the same account only if the email matches, and
then they show up as two linked accounts.

**The nonce is required, not optional.** Slack takes no code challenge and its
authorize endpoint only supports `response_mode=query`, so the id_token nonce
is what binds the token to this request. The strategy refuses to exchange a
code when the state cookie carried no nonce.

**Errors arrive as HTTP 200.** Slack's Web API answers `{"ok": false, "error":
"..."}` with a success status. Both the token exchange and the userinfo call
check the `ok` field, so a failure is reported rather than read as an empty
profile.

**Verification comes from the id_token.** The `email_verified` claim on the
id_token is what the strategy trusts, not the same field on userinfo.

**Distributing the app changes the redirect rules.** Turning on public
distribution makes Slack require HTTPS on every redirect URL, so a localhost
entry has to go before the app can be distributed.
