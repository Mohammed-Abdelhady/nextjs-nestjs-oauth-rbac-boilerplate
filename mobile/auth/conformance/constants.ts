export const CHECK_ID = {
  CREDENTIALS_MISSING: 'credentials.missing',
  CREDENTIALS_FOUND: 'credentials.found',
  CREDENTIALS_REPLACE_OVERWRITES: 'credentials.replace-overwrites',
  CREDENTIALS_REPLACE_ATOMIC: 'credentials.replace-atomic',
  CREDENTIALS_DELETE: 'credentials.delete',
  CREDENTIALS_LOCKED: 'credentials.locked',
  CREDENTIALS_CANCELLED: 'credentials.cancelled',
  CREDENTIALS_CORRUPT: 'credentials.corrupt',
  CREDENTIALS_UNAVAILABLE: 'credentials.unavailable',
  BROWSER_REDIRECT: 'authBrowser.redirect',
  BROWSER_CANCELLED: 'authBrowser.cancelled',
  BROWSER_DISMISSED: 'authBrowser.dismissed',
  BROWSER_FAILED: 'authBrowser.failed',
  BROWSER_ABORT: 'authBrowser.abort',
  CRYPTO_PKCE_VECTOR: 'crypto.pkce-vector',
  CRYPTO_SHA256_BYTES: 'crypto.sha256-bytes',
  CRYPTO_RANDOM_BYTES: 'crypto.random-bytes',
  CALLBACKS_COLD_START: 'callbacks.cold-start-once',
  CALLBACKS_NO_COLD_START: 'callbacks.no-cold-start',
  CALLBACKS_WARM_START: 'callbacks.warm-start-once',
  CALLBACKS_SAME_ADDRESS: 'callbacks.same-address-both-ways',
  CALLBACKS_UNSUBSCRIBE: 'callbacks.unsubscribe',
  CLOCK_MONOTONIC: 'clock.monotonic-never-backwards',
  CLOCK_MONOTONIC_UNIT: 'clock.monotonic-milliseconds',
  CLOCK_WALL_UNIT: 'clock.wall-milliseconds',
  TIMER_FIRES_ONCE: 'timer.fires-once',
  TIMER_CANCEL: 'timer.cancel',
  INSTALL_FOUND: 'install.found',
  INSTALL_UNAVAILABLE: 'install.unavailable',
} as const;

/** RFC 7636 appendix B. */
export const PKCE_VECTOR = {
  VERIFIER: 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk',
  CHALLENGE: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
} as const;

/** Not valid UTF-8, so an adapter that hashes text instead of bytes gets it wrong. */
export const BINARY_VECTOR = {
  INPUT: [0, 255, 128, 254, 193, 10],
  DIGEST: [
    183, 52, 244, 200, 237, 6, 221, 37, 127, 96, 238, 167, 127, 33, 193, 4, 124, 61, 53, 200, 201,
    116, 174, 96, 121, 136, 167, 167, 28, 174, 95, 216,
  ],
} as const;

export const EMPTY_DIGEST = [
  227, 176, 196, 66, 152, 252, 28, 20, 154, 251, 244, 200, 153, 111, 185, 36, 39, 174, 65, 228, 100,
  155, 147, 76, 164, 149, 153, 27, 120, 82, 184, 85,
] as const;

export const SHA256_LENGTH = 32;
export const RANDOM_LENGTHS = [1, 32, 96] as const;

export const SAMPLE = {
  RECORD: '{"v":1,"name":"Zoë 你好","token":"first"}',
  NEXT_RECORD: '{"v":1,"token":"second"}',
  AUTHORIZE_ADDRESS:
    'https://api.example.test/api/oauth/authorize?client_id=native&state=Ab_1-2&scope=api%20read',
  RETURN_ADDRESS: 'sampleapp://auth/callback?code=Xy_9-Z&state=Ab_1-2',
  OTHER_RETURN_ADDRESS: 'sampleapp://auth/callback?code=Qr_7-T&state=Cd_3-4',
} as const;

/** 2017-07-14 and 2100-01-01 in milliseconds. Seconds and microseconds fall outside. */
export const WALL_TIME_RANGE_MS = { MIN: 1_500_000_000_000, MAX: 4_102_444_800_000 } as const;
export const ELAPSE_MS = 1000;
/** A real wait overshoots a little. A wrong unit is off by a thousand. */
export const ELAPSE_CEILING_FACTOR = 5;
export const WALL_JUMP_BACK_MS = -3_600_000;
export const MONOTONIC_SAMPLES = 5;
export const TIMER_DELAY_MS = 200;
