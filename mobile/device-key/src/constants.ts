/** The name the Swift and Kotlin modules register, for `requireNativeModule`. */
export const NATIVE_MODULE_NAME = 'AppDeviceKey';

/** The shell picks one. There is no default, so a software key is never a surprise. */
export const KEY_PROTECTION = {
  HARDWARE_ONLY: 'hardwareOnly',
  SOFTWARE_ALLOWED: 'softwareAllowed',
} as const;

export const PROTECTION_LEVEL = {
  SECURE_ENCLAVE: 'secureEnclave',
  STRONG_BOX: 'strongBox',
  TRUSTED_ENVIRONMENT: 'trustedEnvironment',
  SOFTWARE: 'software',
} as const;

/** Codes the native modules reject with. Swift and Kotlin spell the same strings. */
export const NATIVE_ERROR_CODE = {
  UNAVAILABLE: 'ERR_DEVICE_KEY_UNAVAILABLE',
  NO_HARDWARE: 'ERR_DEVICE_KEY_NO_HARDWARE',
  NOT_FOUND: 'ERR_DEVICE_KEY_NOT_FOUND',
  INVALIDATED: 'ERR_DEVICE_KEY_INVALIDATED',
  INVALID_ALIAS: 'ERR_DEVICE_KEY_INVALID_ALIAS',
} as const;

export const NATIVE_CONDITION = {
  UNAVAILABLE: 'unavailable',
  NO_SECURE_HARDWARE: 'noSecureHardware',
  NOT_FOUND: 'notFound',
  INVALIDATED: 'invalidated',
} as const;

export const ALIAS_PREFIX = 'devicekey';
export const ALIAS_SEPARATOR = '.';
export const ALIAS_ESCAPE = '_';
export const ALIAS_ESCAPE_DIGITS = 4;
/** The alias is also a file name on both platforms. The native side refuses longer ones too. */
export const ALIAS_MAX_LENGTH = 200;
export const ALIAS_PROTECTION_PART = {
  [KEY_PROTECTION.HARDWARE_ONLY]: 'hw',
  [KEY_PROTECTION.SOFTWARE_ALLOWED]: 'sw',
} as const;
export const ALIAS_TOO_LONG_MESSAGE = 'The device key alias is too long.';

export const P256_COORDINATE_BYTES = 32;
export const P256_POINT_BYTES = 65;
export const UNCOMPRESSED_POINT_LEAD = 0x04;
export const RAW_SIGNATURE_BYTES = 64;
/** Everything before the point in a DER SubjectPublicKeyInfo for a P-256 key. */
export const P256_SPKI_PREFIX: readonly number[] = [
  0x30, 0x59, 0x30, 0x13, 0x06, 0x07, 0x2a, 0x86, 0x48, 0xce, 0x3d, 0x02, 0x01, 0x06, 0x08, 0x2a,
  0x86, 0x48, 0xce, 0x3d, 0x03, 0x01, 0x07, 0x03, 0x42, 0x00,
];

export const DER_TAG = {
  SEQUENCE: 0x30,
  INTEGER: 0x02,
} as const;
/** Lengths from here up use the long form, which a P-256 signature never needs. */
export const DER_LONG_FORM = 0x80;
export const DER_SIGN_BIT = 0x80;
/** The shortest signature: a sequence of two one-byte integers. */
export const DER_SIGNATURE_MIN_BYTES = 8;

export const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const BASE64URL_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
export const BASE64_PADDING = '=';
