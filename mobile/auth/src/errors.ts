import { SdkError } from '@app/sdk';

export type AuthPortFailureReason = 'timedOut' | 'failed';

export class AuthPortError extends SdkError {
  constructor(
    readonly operation: string,
    readonly reason: AuthPortFailureReason,
    cause?: unknown,
  ) {
    super(`Native auth port ${operation} ${reason}`, { cause });
    this.name = 'AuthPortError';
  }
}

export function authPortFailure(error: unknown, operation: string): AuthPortError {
  return error instanceof AuthPortError ? error : new AuthPortError(operation, 'failed', error);
}

export class AuthSessionError extends SdkError {
  constructor(message = 'Authentication is required') {
    super(message);
    this.name = 'AuthSessionError';
  }
}

export class UnsafeRequestPathError extends SdkError {
  constructor() {
    super('The native auth transport refused an unsafe request path');
    this.name = 'UnsafeRequestPathError';
  }
}

export class AuthDisposedError extends SdkError {
  constructor() {
    super('The authentication engine has been disposed');
    this.name = 'AuthDisposedError';
  }
}
