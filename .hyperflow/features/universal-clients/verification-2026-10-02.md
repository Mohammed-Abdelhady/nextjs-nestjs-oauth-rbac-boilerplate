# Real-environment check, milestone 1

| Field   | Value                                                                                    |
| ------- | ---------------------------------------------------------------------------------------- |
| Status  | Passed for what was exercised. Three areas not exercised, listed below                   |
| Date    | 2026-10-02                                                                               |
| Head    | `plan/native-continuation` (PR #161), the top of the stack                               |
| Setup   | Real MongoDB replica set (one node), API dev server on port 5001, web dev server on 3000 |
| Browser | Real Chromium, driven through the pages. No test doubles between browser and API         |
| Node    | 24.21.0. The project pins 22                                                             |

## TL;DR

The repaired stack works in a real browser against a real database, on the split-port setup that was
broken before. The mobile sign-in journey completes end to end: start, sign in, confirm, return to the
app, exchange the code, call the API, refresh, replay. Docker, nginx and a real mobile app were not
part of this run.

## What was run

| #   | Scenario                                                                                         | Result                                                         |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| 1   | All nine migrations on an empty database through the migration tool                              | Pass                                                           |
| 2   | Seed, then API start. The API adds the web address to its allowed origins itself                 | Pass                                                           |
| 3   | Wrong password, from port 3000 to port 5001                                                      | Pass. 401 with the right message, no origin or proof rejection |
| 4   | Retry with the right password on the same page                                                   | Pass. A new proof is fetched, sign-in succeeds                 |
| 5   | Requests made: first attempt asks for the session, then a proof. The retry asks only for a proof | Pass                                                           |
| 6   | Signed-in person posts to a public form with the session token                                   | Pass. The request reaches the handler                          |
| 7   | Same with a wrong token, and a protected change with no proof                                    | Pass. Both refused with 403                                    |
| 8   | Protected change with the session token                                                          | Pass                                                           |
| 9   | Authorize start with `Accept-Language: ar`                                                       | Pass. 302 to the Arabic page, `no-store`                       |
| 10  | Confirmation page, English: account, "Not you?", heading, two actions, focus on the heading      | Pass                                                           |
| 11  | Confirmation page loads with two requests: profile and the request details                       | Pass                                                           |
| 12  | Continue. The browser arrives at the app's address with a code and the same state                | Pass                                                           |
| 13  | Exchange with the wrong verifier                                                                 | Pass. Refused, and the code is spent                           |
| 14  | Exchange with the right verifier                                                                 | Pass. Bearer, 300 seconds, with a refresh token                |
| 15  | Same code again                                                                                  | Pass. Refused                                                  |
| 16  | Read and change the profile with the access token, no browser proof                              | Pass                                                           |
| 17  | Refresh token used as an access token, and a garbage token                                       | Pass. 401                                                      |
| 18  | Refresh, then replay the old refresh token                                                       | Pass. Replay refused and the newer access token stops working  |
| 19  | Confirmation page, Arabic: right-to-left, mirrored, no overflow                                  | Pass                                                           |
| 20  | Cancel. The app receives `access_denied` and the same state, no code                             | Pass                                                           |
| 21  | Reopen a finished request                                                                        | Pass. Expired view, no approve control, focus on the heading   |
| 22  | "Not you?", sign in again, land back on the same request, Continue                               | Pass                                                           |
| 23  | Signed out at 375px in Arabic: sent to sign-in, back to the request                              | Pass. Targets 44px high, no horizontal overflow                |

## Found during the run

| Sev     | Where                             | What                                                                                                                                                                                                       | State          |
| ------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| Warning | forgot-password (on master today) | With no mail server, a real address answers "could not send" and an unknown one answers "if an account exists". That reveals which addresses have accounts                                                 | Open           |
| Warning | confirmation page, custom scheme  | With no app installed to handle the address, this browser replaced the page with its own error page, so the "open the app again" state never appears. To be checked on a device once the mobile app exists | Open           |
| Note    | native applications               | Nothing in the product creates a native application record. The run inserted one by hand. Planned with the mobile shells                                                                                   | Open           |
| Note    | port 5000                         | macOS uses port 5000 for AirPlay. The example config already uses 5001                                                                                                                                     | None needed    |
| Note    | dev overlay                       | Next.js showed "2 issues" once after the first sign-in on a cold dev server. Not reproduced in three clean runs                                                                                            | Not reproduced |

## Not exercised

- Docker, the compose files and nginx. Docker is not installed on the machine used.
- The production build of the web app. The dev server was used.
- A real mobile app, the system browser sheet on iOS or Android, and universal links.
- Magic link, two-factor, passkey and OAuth provider sign-in as the way into the confirmation page.
  Password sign-in was used. The other methods are covered by automated tests only.
- Node 22.

## How it was set up

- Database: `mongodb-memory-server` replica set on a fixed port, the same binary the test suites use.
- Configuration: variable names and defaults from `backend/.env.example`, with the port, database
  address, web address and the mobile sign-in switch set for the run.
- Users: the project's seed, with passwords generated for the run and kept out of the repository.
- Mobile app stand-in: a listener on a loopback address registered as the application's redirect
  address, plus `curl` for the token calls.
