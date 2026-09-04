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
 * Login response from API
 * Uses httpOnly cookies for session management (no token in response)
 */
export interface LoginResponse {
  user: User;
  message?: string;
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
