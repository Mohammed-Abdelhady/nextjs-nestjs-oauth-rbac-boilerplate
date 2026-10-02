export const OAUTH_ERROR = {
  INVALID_REQUEST: 'invalid_request',
  INVALID_CLIENT: 'invalid_client',
  INVALID_GRANT: 'invalid_grant',
  UNAUTHORIZED_CLIENT: 'unauthorized_client',
  UNSUPPORTED_GRANT_TYPE: 'unsupported_grant_type',
  UNSUPPORTED_RESPONSE_TYPE: 'unsupported_response_type',
  INVALID_SCOPE: 'invalid_scope',
  ACCESS_DENIED: 'access_denied',
} as const;

export type OauthErrorCode = (typeof OAUTH_ERROR)[keyof typeof OAUTH_ERROR];

export interface OauthFailure {
  ok: false;
  status: number;
  error: OauthErrorCode;
}

export interface AuthorizeBegin {
  ok: true;
  transactionId: string;
}

export interface TokenSuccess {
  ok: true;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string;
}

export interface RevokeSuccess {
  ok: true;
}

export function oauthFailure(
  status: number,
  error: OauthErrorCode,
): OauthFailure {
  return { ok: false, status, error };
}

export interface AuthorizeQuery {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  state?: string;
  scope?: string;
}

export interface TokenRequest {
  grant_type?: string;
  code?: string;
  redirect_uri?: string;
  client_id?: string;
  client_secret?: string;
  code_verifier?: string;
  refresh_token?: string;
}

export interface RevokeRequest {
  token?: string;
  client_id?: string;
  client_secret?: string;
}

export interface ClientMeta {
  ip: string;
  userAgent: string;
}
