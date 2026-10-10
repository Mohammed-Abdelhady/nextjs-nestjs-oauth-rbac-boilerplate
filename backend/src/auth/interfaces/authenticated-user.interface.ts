/** Account summary every sign-in route returns alongside the session cookie. */
export interface AuthenticatedUserSummary {
  id: string;
  email: string;
  name: string;
  role: string;
  authProvider: string;
  isVerified: boolean;
  permissions: string[];
}
