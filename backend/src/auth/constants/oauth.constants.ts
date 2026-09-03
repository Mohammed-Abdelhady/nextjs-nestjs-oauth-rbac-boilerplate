import { AuthProvider } from '../../user/enums/auth-provider.enum';

export type OAuthProvider = 'google' | 'facebook' | 'github';

export const AUTH_PROVIDER_MAP: Record<OAuthProvider, AuthProvider> = {
  google: AuthProvider.GOOGLE,
  facebook: AuthProvider.FACEBOOK,
  github: AuthProvider.GITHUB,
};
