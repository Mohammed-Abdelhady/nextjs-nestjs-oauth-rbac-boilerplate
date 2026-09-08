/** Routes behind the passkey screens. */
const PASSKEY_BASE_PATH = '/api/auth/passkeys';

export const PASSKEY_PATHS = {
  REGISTER_OPTIONS: `${PASSKEY_BASE_PATH}/register/options`,
  REGISTER_VERIFY: `${PASSKEY_BASE_PATH}/register/verify`,
  LIST: PASSKEY_BASE_PATH,
  LOGIN_OPTIONS: `${PASSKEY_BASE_PATH}/login/options`,
  LOGIN_VERIFY: `${PASSKEY_BASE_PATH}/login/verify`,
  /**
   * Answering a held sign-in with a passkey instead of a code. The route is
   * the two-factor module's, spelled out here so this module keeps building in
   * a project that was generated without the second factor.
   */
  TWO_FACTOR_VERIFY: '/api/auth/2fa/verify',
} as const;

/** One passkey by id, for rename and delete. */
export function passkeyPath(passkeyId: string): string {
  return `${PASSKEY_BASE_PATH}/${passkeyId}`;
}

/** Longest name a passkey may carry. Mirrors the backend limit. */
export const PASSKEY_NAME_MAX_LENGTH = 64;

/**
 * What went wrong during a browser ceremony, as a key under
 * `auth.passkeys.errors`. The browser reports these as DOMExceptions, which
 * carry a name and a message written for developers.
 */
export const WEBAUTHN_ERROR_KEY = {
  /** The prompt was dismissed, timed out, or the device refused it. */
  NOT_ALLOWED: 'notAllowed',
  /** The authenticator already holds a passkey for this account. */
  INVALID_STATE: 'invalidState',
  /** Another ceremony started, or the page called abort. */
  ABORTED: 'aborted',
  /** The browser or the authenticator cannot do what was asked. */
  UNSUPPORTED: 'unsupported',
  FAILED: 'failed',
} as const;

export type WebAuthnErrorKey = (typeof WEBAUTHN_ERROR_KEY)[keyof typeof WEBAUTHN_ERROR_KEY];

/** DOMException names the ceremonies raise, and what to say about each. */
export const WEBAUTHN_DOM_ERROR_KEYS: Readonly<Record<string, WebAuthnErrorKey>> = {
  NotAllowedError: WEBAUTHN_ERROR_KEY.NOT_ALLOWED,
  InvalidStateError: WEBAUTHN_ERROR_KEY.INVALID_STATE,
  AbortError: WEBAUTHN_ERROR_KEY.ABORTED,
  NotSupportedError: WEBAUTHN_ERROR_KEY.UNSUPPORTED,
  ConstraintError: WEBAUTHN_ERROR_KEY.UNSUPPORTED,
};

/** What the authenticator said about where the credential lives. */
export const PASSKEY_DEVICE_TYPE = {
  /** Bound to the one device that created it. */
  SINGLE: 'singleDevice',
  /** Synced through a provider keychain. */
  MULTI: 'multiDevice',
} as const;

export type PasskeyDeviceType = (typeof PASSKEY_DEVICE_TYPE)[keyof typeof PASSKEY_DEVICE_TYPE];

/** Device families a default passkey name is offered for. */
export const DEVICE_LABEL_KEY = {
  MAC: 'mac',
  IPHONE: 'iphone',
  IPAD: 'ipad',
  ANDROID: 'android',
  WINDOWS: 'windows',
  LINUX: 'linux',
  OTHER: 'other',
} as const;

export type DeviceLabelKey = (typeof DEVICE_LABEL_KEY)[keyof typeof DEVICE_LABEL_KEY];
