/**
 * Sign-in methods a deployment can turn on or off. The values double as the
 * keys of the discovery endpoint payload.
 */
export enum AuthFeature {
  /** Register, login, forgot password and reset password. */
  PASSWORD = 'password',
  /** One-time sign-in links mailed to an address. */
  MAGIC_LINK = 'magicLink',
}
