/**
 * Toast Message Constants
 *
 * Centralized toast message templates with i18n keys.
 * All messages use next-intl translation keys for multilingual support.
 */

/**
 * Success message keys
 */
export const SUCCESS_MESSAGES = {
  // Authentication
  LOGIN_SUCCESS: 'toast.success.loginSuccess',
  LOGOUT_SUCCESS: 'toast.success.logoutSuccess',
  REGISTRATION_SUCCESS: 'toast.success.registrationSuccess',
  EMAIL_VERIFIED: 'toast.success.emailVerified',
  PASSWORD_RESET_SENT: 'toast.success.passwordResetSent',
  PASSWORD_CHANGED: 'toast.success.passwordChanged',

  // Profile
  PROFILE_UPDATED: 'toast.success.profileUpdated',
  AVATAR_UPLOADED: 'toast.success.avatarUploaded',

  // Generic
  SAVE_SUCCESS: 'toast.success.saveSuccess',
  DELETE_SUCCESS: 'toast.success.deleteSuccess',
  COPY_SUCCESS: 'toast.success.copySuccess',
} as const;

/**
 * Error message keys
 */
export const ERROR_MESSAGES = {
  // Network errors
  NETWORK_ERROR: 'toast.error.networkError',
  TIMEOUT_ERROR: 'toast.error.timeoutError',
  CONNECTION_LOST: 'toast.error.connectionLost',

  // Authentication errors
  INVALID_CREDENTIALS: 'toast.error.invalidCredentials',
  SESSION_EXPIRED: 'toast.error.sessionExpired',
  UNAUTHORIZED: 'toast.error.unauthorized',
  FORBIDDEN: 'toast.error.forbidden',

  // Validation errors
  VALIDATION_FAILED: 'toast.error.validationFailed',
  INVALID_INPUT: 'toast.error.invalidInput',
  REQUIRED_FIELDS: 'toast.error.requiredFields',

  // Server errors
  SERVER_ERROR: 'toast.error.serverError',
  SERVICE_UNAVAILABLE: 'toast.error.serviceUnavailable',
  MAINTENANCE_MODE: 'toast.error.maintenanceMode',

  // Generic
  UNKNOWN_ERROR: 'toast.error.unknownError',
  OPERATION_FAILED: 'toast.error.operationFailed',
} as const;

/**
 * Warning message keys
 */
export const WARNING_MESSAGES = {
  UNSAVED_CHANGES: 'toast.warning.unsavedChanges',
  SLOW_CONNECTION: 'toast.warning.slowConnection',
  SESSION_EXPIRING: 'toast.warning.sessionExpiring',
  QUOTA_LIMIT: 'toast.warning.quotaLimit',
  DEPRECATED_FEATURE: 'toast.warning.deprecatedFeature',
} as const;

/**
 * Info message keys
 */
export const INFO_MESSAGES = {
  LOADING: 'toast.info.loading',
  PROCESSING: 'toast.info.processing',
  PLEASE_WAIT: 'toast.info.pleaseWait',
  FEATURE_COMING_SOON: 'toast.info.featureComingSoon',
  TIP_OF_THE_DAY: 'toast.info.tipOfTheDay',
} as const;

/**
 * Status code to message key mapping
 */
export const STATUS_CODE_MESSAGES: Record<number, string> = {
  // Client errors (4xx)
  400: ERROR_MESSAGES.VALIDATION_FAILED,
  401: ERROR_MESSAGES.UNAUTHORIZED,
  403: ERROR_MESSAGES.FORBIDDEN,
  404: 'toast.error.notFound',
  408: ERROR_MESSAGES.TIMEOUT_ERROR,
  422: ERROR_MESSAGES.INVALID_INPUT,
  429: 'toast.error.tooManyRequests',

  // Server errors (5xx)
  500: ERROR_MESSAGES.SERVER_ERROR,
  502: 'toast.error.badGateway',
  503: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
  504: ERROR_MESSAGES.TIMEOUT_ERROR,
};

/**
 * Default toast durations in milliseconds
 */
export const TOAST_DURATION = {
  SUCCESS: 4000,
  ERROR: 5000,
  WARNING: 6000,
  INFO: 4000,
  LOADING: Infinity, // Must be manually dismissed
  CRITICAL_ERROR: Infinity, // Server errors require manual acknowledgment
  NETWORK_ERROR: 10000, // Time to check the connection
  TIMEOUT_ERROR: 8000,
} as const;

/**
 * Toast configuration defaults
 */
export const TOAST_CONFIG = {
  MAX_VISIBLE: 5,
  POSITION: 'bottom-right' as const,
  DEDUPLICATION_WINDOW: 5000, // 5 seconds
  CLEANUP_INTERVAL: 60000, // 1 minute
  MAX_CACHE_SIZE: 100,
} as const;
