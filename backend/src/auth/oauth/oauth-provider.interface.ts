/**
 * Contract every OAuth provider implements. The registry resolves strategies by
 * `id`, so nothing outside a strategy needs to know which providers exist.
 */
export interface OAuthProviderStrategy {
  /** Slug used in routes, storage and the provider list, for example 'google'. */
  readonly id: string;

  /** Human readable name for the provider list. */
  readonly displayName: string;

  /** Environment variable prefix, for example 'OAUTH_GOOGLE'. */
  readonly envPrefix: string;

  /** Send a PKCE code challenge on authorize and a verifier on exchange. */
  readonly supportsPkce: boolean;

  /** Provider returns an id_token that carries a nonce. */
  readonly usesOidc: boolean;

  /** Provider only ever returns addresses it has verified itself. */
  readonly emailAlwaysVerified: boolean;

  /** True when the provider has credentials configured. */
  isEnabled(): boolean;

  getAuthorizationUrl(params: AuthorizationUrlParams): string;

  exchangeCode(params: ExchangeCodeParams): Promise<OAuthTokens>;

  fetchProfile(tokens: OAuthTokens): Promise<OAuthProfile>;
}

export interface AuthorizationUrlParams {
  state: string;
  redirectUri: string;
  codeChallenge?: string;
  nonce?: string;
}

export interface ExchangeCodeParams {
  code: string;
  redirectUri: string;
  codeVerifier?: string;
  /** Expected id_token nonce for providers with `usesOidc`. */
  nonce?: string;
}

export interface OAuthTokens {
  accessToken: string;
  idToken?: string;
  refreshToken?: string;
  expiresIn?: number;
  scope?: string;
  tokenType?: string;
}

export interface OAuthProfile {
  providerId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatarUrl?: string;
}

/** Entry of the public provider list. */
export interface OAuthProviderSummary {
  id: string;
  displayName: string;
}
