import { ErrorCode as BackendErrorCode } from '../enums/error-code.enum';
import { ALL_PERMISSIONS as BackendAllPermissions } from './permissions';
import { PASSWORD_MIN_LENGTH } from './password';
import { ErrorCode as SharedErrorCode } from '../../../../shared/core/src/error-codes';
import { ALL_PERMISSIONS as SharedAllPermissions } from '../../../../shared/core/src/permissions';
import { MIN_PASSWORD_LENGTH as SharedMinPasswordLength } from '../../../../shared/core/src/password-rules';

// Backend-only error codes the web client maps by status code or a generic message instead.
const BACKEND_ONLY_ERROR_CODES = [
  'CONFLICT', // generic 409; the web client maps 409 by status code.
  'EMAIL_CHANGE_NOT_ALLOWED', // no admin email-change form on the web client; falls back to FORBIDDEN.
  'ROLE_NOT_FOUND', // role seeding lookup; the web client surfaces generic NOT_FOUND.
];

function sortedStrings(values: readonly unknown[]): string[] {
  return [...new Set(values.map(String))].sort();
}

describe('shared core drift', () => {
  it('keeps the same permission strings on both sides', () => {
    const backend = sortedStrings(BackendAllPermissions);
    const shared = sortedStrings(SharedAllPermissions);

    expect(shared).toEqual(backend);
  });

  it('keeps the same error-code values except the named backend-only ones', () => {
    const backend = sortedStrings(Object.values(BackendErrorCode));
    const shared = sortedStrings(Object.values(SharedErrorCode));

    const backendOnly = backend.filter((code) => !shared.includes(code));
    const sharedOnly = shared.filter((code) => !backend.includes(code));

    expect(backendOnly).toEqual([...BACKEND_ONLY_ERROR_CODES].sort());
    expect(sharedOnly).toEqual([]);
  });

  it('keeps the same minimum password length on both sides', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(SharedMinPasswordLength);
  });
});
