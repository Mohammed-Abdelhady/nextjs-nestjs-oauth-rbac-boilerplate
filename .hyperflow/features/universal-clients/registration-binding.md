# Registration: stop the first caller choosing someone else's password

| Field  | Value                                                                            |
| ------ | -------------------------------------------------------------------------------- |
| Status | v2, after debate. Ready for piece A3a once A2 is merged                          |
| Date   | 2026-10-03                                                                       |
| Found  | A2 security reviews on 2026-10-02 and 2026-10-03, rated Critical, older than A2  |
| Scope  | `backend/src/auth` and `backend/src/admin` email confirmation, the two web forms |
| On     | `master` and `staging` today                                                     |

## TL;DR

Today the password is taken at registration and kept on the pending record. A second registration for
the same address inside the live window keeps the first password and only mails a new code, so whoever
registers an address first chooses the password of the account its owner later confirms. The fix: the
password and the name arrive in the same request as the mailed code, and nothing a caller supplied
before proving the address is ever used to build an account. The debate widened the piece: sign-up
and address confirmation become two separate operations, the account is created in the same
transaction that consumes the code, and old pending records are discarded, not honoured.

## The defect, as a sequence

1. An attacker registers `victim@x` with a password they know. They need the address and an ordinary
   registration request. No mailbox access, no stolen session, no code guessing.
2. The record lives fifteen minutes by default and each registration extends it. Five registrations
   per fifteen minutes are allowed, so refreshing every ten minutes keeps it alive.
3. The victim registers with their own password inside that window. The reply is the normal 200 and a
   working code arrives. The mail may greet them by the attacker's chosen name.
4. The victim enters the code. The account is created with the attacker's password and the victim is
   signed in.
5. The attacker signs in with the password from step 1. The victim's own password fails later. If the
   victim turned on two-step sign-in first, the attacker's password alone is not enough.

This is account pre-hijacking. Replacing the stored password on every registration does not fix it, it
only changes who must go last.

## Decision

Option A from the first draft: registration takes the address only, and activation takes the code, the
password and the name.

| Option                                                         | Verdict                                                                                                                                                           |
| -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A. Password at activation                                      | Chosen. One invariant a fork cannot easily break: no credential exists before proof                                                                               |
| B. Token held by the client                                    | Rejected. Every fork must carry a secret through reloads, tabs, resend and the app's browser session, and a new token with the old password reproduces the defect |
| Client keeps the password in memory and sends it with the code | Allowed as a fork's own choice. Same server contract as A. Lost on reload, never stored                                                                           |
| Keep it and warn                                               | Rejected. Does not fix it                                                                                                                                         |

## Contract

Registration, `POST /auth/register`:

- Body: `email`. A `password` or `name` in the body is an old client: answer a stable contract error
  that depends only on the body, never on the address.
- Mails a code with a neutral greeting. Stores address, code hash, attempts, expiry, purpose `signup`.
  No password hash, no name.

Activation, `POST /auth/activate`:

- Body: `email`, `code`, `password`, `name`.
- Order: validate the body, reserve one attempt, compare the code, hash the password, then in one
  transaction consume that exact pending generation (recheck expiry and code hash) and create the
  account. Sign in after the commit, through the same path every other sign-in uses, so two-step
  sign-in rules apply.
- An invalid body answers field errors before any look-up, spends no attempt and runs no comparison.
  A valid body with a wrong, missing, expired, exhausted, replayed or superseded code answers the one
  shared failure from A2 with exactly one comparison.
- A resend or a new registration while the password is being hashed makes the old activation fail,
  because the generation it compared is gone.
- If the address already has an account when the transaction runs (another sign-in method created it
  meanwhile), nothing is overwritten and nobody is signed in. Sign-up never verifies, changes or signs
  into an existing account because its address matches.
- A failure before the commit leaves the code usable until it expires or runs out of attempts. A
  failure after the commit tells the user to sign in normally.

Address confirmation after an admin changes a user's email is its own operation with its own route:

- The pending record carries purpose `email-change`, the target user id and that user's address-change
  generation. A sign-up for the same address cannot rewrite it and its code cannot be used for sign-up.
- Confirmation marks the address verified on that user and issues no session. The user signs in
  normally, so two-step sign-in is not skipped. Today activation issues a session directly here.
- It needs no password, so a project generated without password sign-in still confirms addresses.

## Migration

- At deploy, pending sign-up records made under the old contract are deleted. Their password hashes
  are never used. A user in the middle of signing up registers again.
- Pending address confirmations are converted to the new purpose with their target user, or deleted
  and re-issued by an admin. To decide in A3b from what the records allow.
- Old clients get the contract error above from the first request. There is no period in which both
  contracts work, because the old one is the defect.
- Accounts activated before the fix are not repaired by it. Nobody can tell who chose their password.
  The release note says so, and suggests a password reset for accounts that never signed in again.

## Also fixed here, because the piece touches them

- The sign-up link on the sign-in page drops the app's return address, and activation always ends on
  the dashboard, so signing up from the mobile app cannot return to it. Carry the return address
  through both screens. If the app's authorization has expired (five minutes, shorter than the code's
  fifteen), say so and let the user restart from the app.
- Password length. The server accepts 128 characters and bcrypt uses the first 72 bytes. State one
  policy for sign-up, change and reset, enforce it in bytes, and align the web form's rules with the
  server's. Same for the name rules.
- Mail abuse. Registration can still be used to send repeated mail to an address. Add a per-address
  limit on mailed codes and a hard ceiling on how long a pending record can be extended, independent
  of per-caller limits. This reduces abuse, it does not remove denial of service.

## Tests

- The sequence above against the real database and the real mailed code, with two separate clients:
  the victim activates and signs in with their own password, and the attacker's password fails. Both
  halves, so a change that breaks sign-up for everyone cannot pass.
- Written first against today's code as a failing characterization, then kept as the regression.
- No password hash and no name is stored at registration.
- Latest code accepted, superseded code rejected, replay rejected.
- Two activations at once create one account and the loser cannot change its password.
- Resend or registration during the comparison or the hashing prevents the stale activation.
- Expiry checked at the commit. Attempt limit exact under concurrency.
- Missing, empty, null, malformed, weak and over-long activation fields answer the same for every
  address state and spend no attempt.
- Account write fails before commit: the code still works. Session fails after commit: the account
  stands.
- An account created by another sign-in method wins the collision and does not receive the pending
  password.
- A sign-up code cannot confirm an address change and the reverse. A stale address change cannot
  confirm a different user.
- An old-shape registration is refused the same way for every address. Old records are never honoured.
- A project generated without password sign-in confirms an address change.
- Web: both screens in English and Arabic, field errors announced, values kept after an error, a
  password manager saves the credential on success, phone width with the keyboard open, and the real
  return to the app on the simulator.
- Races use gates, never sleeps. Mutations to run: restore first-password use, drop the generation
  check in the final consume, allow the old-record fallback.

## Pieces

| ID  | Piece                                                                                     | Owner    | After |
| --- | ----------------------------------------------------------------------------------------- | -------- | ----- |
| A3a | The two-client characterization test, failing on today's code                             | DeepSeek | A2    |
| A3b | Server: new contract, purposes, transaction, migration, mail limits, password policy      | Luna     | A3a   |
| A3c | Web forms, the app return address through sign-up, both locales, checked on the simulator | Sol      | A3b   |

`shared/sdk` has no register or activate methods today, so it does not change. The payload types are
in the web app.

## What the debate changed

| Topic          | Draft v1                          | v2                                                            |
| -------------- | --------------------------------- | ------------------------------------------------------------- |
| Name           | Kept from the latest registration | Supplied at activation, neutral greeting in the mail          |
| Finalization   | Consume, then hash, then create   | Hash, then consume and create in one transaction              |
| Address change | Unchanged                         | Own operation, bound to a user, no session issued             |
| Old records    | Drop or honour once               | Always dropped, old clients refused                           |
| First test     | Attacker's password fails         | Victim succeeds and attacker fails                            |
| Mobile         | Unchanged                         | The return to the app through sign-up is repaired or restarts |
| Scope          | Server, two forms, SDK            | SDK untouched, mail limits and password policy added          |
