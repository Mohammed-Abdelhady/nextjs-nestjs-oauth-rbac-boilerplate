export const STORAGE_KEY_SEPARATOR = '.';
export const STORAGE_KEY_ESCAPE = '_';
export const STORAGE_KEY_ESCAPE_DIGITS = 4;
export const CREDENTIALS_KEY_PREFIX = 'auth';
export const INSTALL_ID_KEY = 'app.install-id';
/** The file a shell passes as `installMarker`, in the app's documents folder. */
export const INSTALL_MARKER_FILE = 'install.marker';

export const SHA256_BYTES = 32;

export const BROWSER_RESULT_TYPE = {
  SUCCESS: 'success',
  CANCEL: 'cancel',
  DISMISS: 'dismiss',
  LOCKED: 'locked',
} as const;

export const BROWSER_FAILURE = {
  REDIRECT_WITHOUT_ADDRESS: 'redirectWithoutAddress',
  BROWSER_LOCKED: 'browserLocked',
  UNEXPECTED_RESULT: 'unexpectedResult',
  UNKNOWN: 'unknown',
} as const;

/** Reasons `expo-secure-store` 57.0.4 puts in its error messages, by platform. */
export const STORE_ERROR_TEXT = {
  IOS_INTERACTION_NOT_ALLOWED: 'User interaction is not allowed.',
  IOS_USER_CANCELED: 'User canceled the operation.',
  IOS_DECODE: 'Unable to decode the provided data.',
  ANDROID_UNPARSABLE: 'Could not parse the encrypted JSON item',
  ANDROID_NO_SCHEME: 'Could not find the encryption scheme',
  ANDROID_UNKNOWN_SCHEME: 'has an unknown encoding scheme',
} as const;

export const CRYPTO_FAILURE = {
  RANDOM_LENGTH: 'The random source returned the wrong number of bytes.',
  DIGEST_LENGTH: 'The digest is not 32 bytes long.',
} as const;

export const HEADER = {
  ACCEPT: 'Accept',
  CONTENT_TYPE: 'Content-Type',
} as const;
export const JSON_MEDIA_TYPE = 'application/json';
/** Longer than the 15 seconds the engine allows its own OAuth and profile calls. */
export const REQUEST_DEADLINE_MS = 20_000;
export const REQUEST_DEADLINE_MESSAGE = 'The request passed its deadline.';
