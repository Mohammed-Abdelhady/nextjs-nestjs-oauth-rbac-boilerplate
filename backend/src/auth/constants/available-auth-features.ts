import { AuthFeature } from '../enums/auth-feature.enum';

// Runtime flags cannot enable a method removed from the generated project.
export const AVAILABLE_AUTH_FEATURES = new Set<AuthFeature>([
  AuthFeature.PASSWORD, // feature:email-password
  AuthFeature.MAGIC_LINK, // feature:magic-link
  AuthFeature.TWO_FACTOR, // feature:totp
  AuthFeature.PASSKEYS, // feature:passkeys
]);
