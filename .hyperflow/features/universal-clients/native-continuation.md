# Native sign-in: the browser step

| Field   | Value                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| Status  | Spec, ready for implementation (PR A2)                                                   |
| Date    | 2026-10-01                                                                               |
| Closes  | Finding 19 in `wave-0-findings.md`                                                       |
| Touches | `backend/src/session/native`, `backend/src/auth/magic-link`, `frontend/src/modules/auth` |

## TL;DR

A mobile app opens the browser to sign a person in. Today the server sends that browser to a page that
does not exist, and nothing in the web app can approve the request. This adds the page, keeps the request
alive through every sign-in method, and sends the person back to the app.

## Design read

Reading this as: one confirmation screen inside an existing product sign-in area, for a person who just
tapped "Sign in" in their own mobile app, with a trust-first language, matching the existing auth pages.

- Mode: preserve. Reuse `AuthLayout`, `card`, `button`, `alert`, `avatar`, `skeleton` from
  `frontend/src/components/ui`. No new primitives, no new tokens, no new fonts.
- Dials: match the existing sign-in pages. No decorative motion. State changes only.

### References

- [GitHub authorize, fal](https://mobbin.com/screens/faf59377-ea96-4279-82b2-cafa51825735) and
  [GitHub authorize, v0](https://mobbin.com/screens/d4469e32-4c05-47a2-89dd-57155e549ca6): one centered
  card, the app and the account named in one sentence, primary and cancel actions, and a line saying
  where the browser goes next.
- [LinkedIn authorize, Delphi](https://mobbin.com/screens/bef300b5-09bd-4d58-ac06-6ab5adc8a64d): the
  signed-in account shown with its avatar, and a "Not you?" link directly under it.

Taken from them: the single card, the one-sentence statement of who is granting what, the "Not you?"
escape, and the visible destination.

Deliberate difference: those screens ask permission for a third party, so they lead with a permission
list. This is the person's own app. The screen leads with the destination, "Continue to the app on your
phone", and shows the account as the thing to check. There is no permission list and no toggles.

### Layout

```
[ AuthLayout: language and theme switchers, as on every auth page ]

        ( avatar )  Layla Haddad
                    layla@example.com        Not you?

        Continue to <App name> on your phone

        You will be signed in to the mobile app with this account.

        [ Continue ]            primary
        [ Cancel ]              secondary

        After you continue, this page returns you to the app.
```

- One column, same max width as the sign-in card. Buttons stack, full width, 44px targets.
- Right-to-left: the row mirrors with logical properties only. No `ml-`, `mr-`, `left-`, `right-`.
- Copy lives in an overlay message pair, English and formal Modern Standard Arabic, same arguments.

### States

| State              | What the person sees                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| Loading            | Skeleton in the shape of the card                                                        |
| Signed out         | Redirect to sign-in, then back here                                                      |
| Ready              | The layout above                                                                         |
| Approving          | Continue shows progress and is disabled. Cancel is disabled                              |
| Returning          | "Returning to the app". If the app does not open in 2 seconds, a button to open it again |
| Expired or unknown | "This sign-in request has expired. Go back to the app and try again." No approve button  |
| Mobile sign-in off | The existing message for the disabled state                                              |
| Error              | Inline alert with the mapped error code message, and a retry                             |

## Behaviour

1. `GET /api/oauth/authorize` validates the client, redirect address, PKCE challenge and state, stores a
   transaction that expires in five minutes, and redirects to
   `{CLIENT_URL}/{locale}/auth/native/authorize?transaction=<id>`. The locale comes from the request's
   language, falling back to the default locale. The path is one constant shared with the frontend route.
2. A new endpoint, `GET /api/oauth/authorize/transaction/:id`, returns what the page needs and nothing
   else: application display name, platform, expiry, and whether the signed-in person already has a
   grant. It never returns the redirect address, the challenge or the state. Unknown and expired ids
   give the same answer.
3. Signed out: the page sends the person to sign-in with a continuation. The redirect validator in
   `authHelpers.ts` currently rejects every `/auth/*` path and does not normalise the locale prefix. It
   is changed to normalise the locale and to allow exactly this route with exactly the `transaction`
   query. Every other auth path stays rejected.
4. The continuation survives each sign-in method:
   - Password, two-factor and passkey: the existing `redirect` parameter carries it.
   - OAuth providers: the provider round trip already carries a relative redirect. It must accept this
     route.
   - Magic link: the request form sends the continuation, the server stores it on the magic-link record
     after validating it with the same rule, and the verify step returns it. This works when the link
     is opened in a different browser.
5. Continue calls `POST /api/oauth/authorize/approve`. The server ends the transaction atomically and
   returns the redirect address with the code and state. The page navigates there.
6. Cancel calls a new `POST /api/oauth/authorize/deny`. The server ends the transaction atomically and
   returns the stored redirect address with `error=access_denied` and the stored state.
7. A transaction can be ended once. A second approve or deny gets the expired answer.
8. With mobile sign-in turned off, authorize start and both endpoints refuse, as they already do.

## Tests

- Backend e2e: the full journey with a real HTTP client for each sign-in method that is enabled by
  default, ending in a code that exchanges for tokens. Deny returns the stored state. Second approve
  fails. Expired transaction fails. The transaction endpoint leaks no redirect address.
- Redirect validator: a hand-written table. The new route with a transaction passes in every locale.
  The same route with any other query, any other auth route, a scheme, a double slash and a backslash
  all fail.
- Magic link: continuation stored, validated, returned, and rejected when it is not the allowed route.
- Frontend: each state in the table above renders, in English and Arabic. Continue and Cancel call the
  right endpoint once, including on double click.
- Browser check before merge, English and Arabic, light and dark, 320px and desktop.

## Out of scope

Device binding (PR F), the mobile apps themselves (PR E and G), and consent for third-party clients.
