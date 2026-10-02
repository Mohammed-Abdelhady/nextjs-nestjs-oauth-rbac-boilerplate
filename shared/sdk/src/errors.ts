export interface ApiErrorInit {
  status: number;
  code: string;
  message: string;
  fields?: Record<string, string[]>;
  requestId?: string;
}

/** A response arrived and it was not a success. */
export class ApiError extends Error {
  readonly status: number;
  /** An `@app/core` error code from the body, or one mapped from the status. */
  readonly code: string;
  /** Messages per field, on a validation error. */
  readonly fields?: Record<string, string[]>;
  readonly requestId?: string;

  constructor(init: ApiErrorInit) {
    super(init.message);
    this.name = 'ApiError';
    this.status = init.status;
    this.code = init.code;
    this.fields = init.fields;
    this.requestId = init.requestId;
  }
}

export interface OAuthErrorInit {
  status: number;
  error: string;
}

/** A raw OAuth route refused the request with `{ error }`. */
export class OAuthError extends Error {
  readonly status: number;
  /** The OAuth error string, one of `OAUTH_ERROR` for this server. */
  readonly error: string;

  constructor(init: OAuthErrorInit) {
    super(init.error);
    this.name = 'OAuthError';
    this.status = init.status;
    this.error = init.error;
  }
}
