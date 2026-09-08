/**
 * User role enumeration
 */
export type UserRole = 'user' | 'admin' | 'manager' | 'support';

/**
 * User entity representing authenticated user data
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  permissions: string[];
  /** Only the profile endpoint reports these; a sign-in reply leaves them out. */
  twoFactorEnabled?: boolean;
  /** How many passkeys are registered on the account. */
  passkeyCount?: number;
  linkedProviders?: string[];
}

/**
 * Authentication state managed by Redux
 * Session tokens stored in httpOnly cookies (not in Redux state)
 */
export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

/**
 * Login request payload
 */
export interface LoginRequest {
  email: string;
  password: string;
  rememberMe?: boolean;
}

/**
 * Body every sign-in route returns. When the account owes a second factor
 * there is no session yet, so `user` is null and the code goes to /auth/2fa.
 */
export interface LoginResponse {
  requiresTwoFactor: boolean;
  user: User | null;
  message?: string;
}

/**
 * Sign-in methods this deployment accepts, from GET /api/auth/methods.
 *
 * A backend that does not ship a method leaves its key out, which normalises
 * to off rather than to a button nothing answers.
 */
export interface AuthMethods {
  password: boolean;
  magicLink: boolean;
  twoFactor: boolean;
  passkeys: boolean;
  oauth: AuthMethodProvider[];
}

/**
 * One OAuth provider as the methods endpoint lists it. Same shape as the
 * OAuth module's provider summary, kept separate so the core sign-in types do
 * not depend on a feature module.
 */
export interface AuthMethodProvider {
  id: string;
  displayName: string;
}

/** Payload of the methods endpoint before normalisation. */
export interface AuthMethodsResponse {
  methods: Partial<AuthMethods> & { password: boolean };
}

/**
 * Auth error details
 */
export interface AuthError {
  message: string;
  code?: string;
  field?: string;
}

/**
 * Registration request payload
 */
export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

/**
 * Registration response from API
 */
export interface RegisterResponse {
  success: boolean;
  message: string;
  data: {
    email: string;
  };
}

/**
 * Account activation request payload
 */
export interface ActivateRequest {
  email: string;
  code: string;
}

/**
 * Account activation response from API
 * Uses httpOnly cookies for session management (no token in response)
 */
export interface ActivateResponse {
  user: User;
}

/**
 * Resend activation code request payload
 */
export interface ResendActivationRequest {
  email: string;
}

/**
 * Resend activation code response from API
 */
export interface ResendActivationResponse {
  success: boolean;
  message: string;
  data: {
    email: string;
  };
}

/**
 * Forgot password request payload
 */
export interface ForgotPasswordRequest {
  email: string;
}

/**
 * Forgot password response from API
 */
export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

/**
 * Reset password request payload
 */
export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}

/**
 * Reset password response from API
 */
export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}
