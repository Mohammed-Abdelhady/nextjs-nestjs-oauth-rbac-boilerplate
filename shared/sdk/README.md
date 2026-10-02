# @app/sdk

API paths, wire types and response handling for the routes a signed-in person's
first screens need, plus a typed client over an injected transport.

## Who uses what today

The web app uses seven operations on six paths from this package: the paths
(`API_PATHS`), the wire types, and the readers that unwrap a parsed body
(`unwrapObjectBody`, `unwrapSessionListBody`, `unwrapAuthMethodsBody`). It keeps
its own RTK Query endpoints and cache.

| Route                                   | Web app | Client method                         |
| --------------------------------------- | ------- | ------------------------------------- |
| `GET /api/user/profile`                 | yes     | `profile.get`                         |
| `PATCH /api/user/profile`               | yes     | `profile.update`                      |
| `GET /api/user/sessions`                | yes     | `sessions.list`                       |
| `DELETE /api/user/sessions/:id`         | yes     | `sessions.revoke`                     |
| `POST /api/user/sessions/revoke-others` | yes     | `sessions.revokeOthers`               |
| `GET /api/auth/methods`                 | yes     | `auth.methods`                        |
| `POST /api/auth/logout`                 | yes     | `auth.signOut`                        |
| `POST /api/oauth/token`                 | no      | `oauth.exchangeCode`, `oauth.refresh` |
| `POST /api/oauth/revoke`                | no      | `oauth.revoke`                        |

The web app does not call the two OAuth paths (three client methods) and
cannot: the server refuses them when a session cookie is present.

`createApiClient` has no production caller yet. It is written for the mobile
app, which will inject a bearer transport. Until then it is exercised by this
package's tests and by `backend/test/sdk-contract.e2e-spec.ts`, which drives the
real server through it.

## Known gaps on a bearer transport

The server reads the current session of these calls from the session cookie
only. A bearer caller gets the following today, and the contract spec pins each
one so the server change that fixes them has to update it:

- `auth.signOut()` answers 401 `SESSION_INVALID`. Sign out with `oauth.revoke`.
- `sessions.revokeOthers()` answers 401 `SESSION_INVALID`.
- `sessions.list()` returns browser sessions only, with `isCurrent` false on
  every row. The caller's own session is not in the list.
- `sessions.revoke(id)` does not refuse the caller's own session.

## Transport

```ts
interface Transport<TSignal> {
  request(request: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    body?: unknown;
    signal?: TSignal;
  }): Promise<{ status: number; body: unknown }>;
}
```

The transport owns the base URL, credentials, and JSON. It serialises `body`,
sets `Content-Type: application/json`, and answers with the parsed JSON or
`undefined` when the response has none. It resolves for every HTTP status and
rejects only when no response was received.

Every client method takes `{ signal }` as its last argument and hands it to the
transport untouched. Pass `AbortSignal` as `TSignal` on a platform that has it.

## Errors

- `ApiError`: a response arrived and was not usable. It carries `status`, `code`
  (from the body, or mapped from the status by `@app/core`), `message`, `fields`
  on a validation error, and `requestId` when the server sent one. A success
  status with a body of the wrong shape is an `ApiError` with `UNKNOWN_ERROR`
  and a message that names what was wrong.
- `OAuthError`: an OAuth route refused with `{ error }`. It carries `status` and
  `error`, one of `OAUTH_ERROR`.
- `TransportError`: no response. `reason` is `aborted` when the caller's signal
  aborted, `no_response` otherwise.
- `TypeError`: a session id that cannot be a path segment (empty, `.` or `..`).

## Dependencies

`@app/core/errors` only, for the error codes, the status mapping and the field
reader. That entry does not load the validators, so this package needs no zod.
