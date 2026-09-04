/**
 * Standard error codes for API responses.
 * Frontend can use these codes for i18n translation and programmatic error handling.
 */
export enum ErrorCode {
  // Authentication errors
  /** Invalid email or password provided */
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  /** Email address is already registered */
  EMAIL_ALREADY_EXISTS = 'EMAIL_ALREADY_EXISTS',

  // Activation errors
  /** Activation code has expired */
  ACTIVATION_CODE_EXPIRED = 'ACTIVATION_CODE_EXPIRED',
  /** Invalid activation code provided */
  ACTIVATION_CODE_INVALID = 'ACTIVATION_CODE_INVALID',
  /** Maximum activation attempts exceeded */
  MAX_ATTEMPTS_EXCEEDED = 'MAX_ATTEMPTS_EXCEEDED',
  /** No pending registration found for email */
  NO_PENDING_REGISTRATION = 'NO_PENDING_REGISTRATION',
  /** No pending registration found for resend activation */
  NO_PENDING_REGISTRATION_FOR_RESEND = 'NO_PENDING_REGISTRATION_FOR_RESEND',
  /** Resend activation rate limit exceeded */
  RESEND_RATE_LIMIT_EXCEEDED = 'RESEND_RATE_LIMIT_EXCEEDED',

  // Email errors
  /** Failed to send email */
  EMAIL_SEND_FAILED = 'EMAIL_SEND_FAILED',

  // Session errors
  /** Authentication session required */
  SESSION_REQUIRED = 'SESSION_REQUIRED',
  /** Session is invalid or malformed */
  SESSION_INVALID = 'SESSION_INVALID',
  /** Session has expired */
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  // Verification errors
  /** Email address not verified */
  EMAIL_NOT_VERIFIED = 'EMAIL_NOT_VERIFIED',

  // Validation errors
  /** Request validation failed */
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  /** Invalid input provided */
  INVALID_INPUT = 'INVALID_INPUT',

  // Rate limiting errors
  /** Rate limit exceeded */
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',

  // Generic errors
  /** Internal server error */
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  /** Resource not found */
  NOT_FOUND = 'NOT_FOUND',
  /** Access forbidden */
  FORBIDDEN = 'FORBIDDEN',
  /** Resource conflict */
  CONFLICT = 'CONFLICT',

  // Admin errors
  /** User does not exist */
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  /** Cannot change own role/status */
  CANNOT_MODIFY_SELF = 'CANNOT_MODIFY_SELF',
  /** Cannot modify user with higher role */
  CANNOT_MODIFY_HIGHER_ROLE = 'CANNOT_MODIFY_HIGHER_ROLE',
  /** Cannot assign ADMIN role via API */
  INVALID_ROLE_ASSIGNMENT = 'INVALID_ROLE_ASSIGNMENT',
  /** User is already deleted */
  USER_ALREADY_DELETED = 'USER_ALREADY_DELETED',

  // OAuth errors
  /** Invalid OAuth provider specified */
  INVALID_OAUTH_PROVIDER = 'INVALID_OAUTH_PROVIDER',
  /** OAuth authentication failed */
  OAUTH_AUTHENTICATION_FAILED = 'OAUTH_AUTHENTICATION_FAILED',
  /** OAuth code is invalid or expired */
  OAUTH_INVALID_CODE = 'OAUTH_INVALID_CODE',

  // Google OAuth errors
  /** Google ID token is invalid */
  GOOGLE_TOKEN_INVALID = 'GOOGLE_TOKEN_INVALID',
  /** Google ID token has expired */
  GOOGLE_TOKEN_EXPIRED = 'GOOGLE_TOKEN_EXPIRED',
  /** Google OAuth not configured */
  GOOGLE_NOT_CONFIGURED = 'GOOGLE_NOT_CONFIGURED',
  /** Google email is not verified */
  GOOGLE_EMAIL_NOT_VERIFIED = 'GOOGLE_EMAIL_NOT_VERIFIED',

  // GitHub OAuth errors
  /** GitHub authorization code is invalid */
  GITHUB_CODE_INVALID = 'GITHUB_CODE_INVALID',
  /** GitHub authorization code has expired */
  GITHUB_CODE_EXPIRED = 'GITHUB_CODE_EXPIRED',
  /** GitHub OAuth not configured */
  GITHUB_NOT_CONFIGURED = 'GITHUB_NOT_CONFIGURED',
  /** GitHub email is not verified */
  GITHUB_EMAIL_NOT_VERIFIED = 'GITHUB_EMAIL_NOT_VERIFIED',
  /** GitHub API error */
  GITHUB_API_ERROR = 'GITHUB_API_ERROR',

  // Facebook OAuth errors
  /** Facebook authorization code is invalid */
  FACEBOOK_CODE_INVALID = 'FACEBOOK_CODE_INVALID',
  /** Facebook authorization code has expired */
  FACEBOOK_CODE_EXPIRED = 'FACEBOOK_CODE_EXPIRED',
  /** Facebook OAuth not configured */
  FACEBOOK_NOT_CONFIGURED = 'FACEBOOK_NOT_CONFIGURED',
  /** Facebook email is not verified */
  FACEBOOK_EMAIL_NOT_VERIFIED = 'FACEBOOK_EMAIL_NOT_VERIFIED',
  /** Facebook API error */
  FACEBOOK_API_ERROR = 'FACEBOOK_API_ERROR',

  // User self-service errors
  /** Current password is incorrect */
  INVALID_CURRENT_PASSWORD = 'INVALID_CURRENT_PASSWORD',
  /** New password is same as current */
  SAME_PASSWORD = 'SAME_PASSWORD',
  /** Session not found */
  SESSION_NOT_FOUND = 'SESSION_NOT_FOUND',
  /** Cannot revoke current session */
  CANNOT_REVOKE_CURRENT_SESSION = 'CANNOT_REVOKE_CURRENT_SESSION',
  /** Admin cannot deactivate their own account */
  ADMIN_CANNOT_DEACTIVATE_SELF = 'ADMIN_CANNOT_DEACTIVATE_SELF',

  // Password reset errors
  /** No password reset request found for email */
  NO_PENDING_PASSWORD_RESET = 'NO_PENDING_PASSWORD_RESET',
  /** Password reset code has expired */
  PASSWORD_RESET_CODE_EXPIRED = 'PASSWORD_RESET_CODE_EXPIRED',
  /** Invalid password reset code provided */
  PASSWORD_RESET_CODE_INVALID = 'PASSWORD_RESET_CODE_INVALID',
  /** User not found for password reset */
  USER_NOT_FOUND_FOR_RESET = 'USER_NOT_FOUND_FOR_RESET',

  // Account linking errors
  /** Provider is already linked to this account */
  PROVIDER_ALREADY_LINKED = 'PROVIDER_ALREADY_LINKED',
  /** Provider ID is already linked to another account */
  PROVIDER_LINKED_TO_OTHER_ACCOUNT = 'PROVIDER_LINKED_TO_OTHER_ACCOUNT',
  /** Email mismatch when linking provider */
  EMAIL_MISMATCH_ON_LINK = 'EMAIL_MISMATCH_ON_LINK',
  /** Cannot unlink last authentication provider */
  CANNOT_UNLINK_LAST_PROVIDER = 'CANNOT_UNLINK_LAST_PROVIDER',
  /** Provider is not linked to this account */
  PROVIDER_NOT_LINKED = 'PROVIDER_NOT_LINKED',
  /** Re-authentication required for sensitive operation */
  REAUTH_REQUIRED = 'REAUTH_REQUIRED',

  // Permission errors
  /** Permission already exists for user */
  PERMISSION_ALREADY_EXISTS = 'PERMISSION_ALREADY_EXISTS',
  /** Permission not found for user */
  PERMISSION_NOT_FOUND = 'PERMISSION_NOT_FOUND',
  /** Invalid permission format */
  INVALID_PERMISSION_FORMAT = 'INVALID_PERMISSION_FORMAT',

  // Role errors
  /** Role slug does not exist in the roles collection */
  ROLE_NOT_FOUND = 'ROLE_NOT_FOUND',
  /** Only admins may change another user's email address */
  EMAIL_CHANGE_NOT_ALLOWED = 'EMAIL_CHANGE_NOT_ALLOWED',
}
