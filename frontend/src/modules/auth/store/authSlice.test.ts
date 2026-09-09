import { describe, expect, it } from 'vitest';
import authReducer, { loginFulfilled, logout } from './authSlice';
import type { User } from '../types/auth.types';

const user: User = {
  id: 'user-1',
  email: 'user@example.com',
  name: 'Ada',
  role: 'user',
  permissions: [],
};

describe('authSlice validation status', () => {
  it('treats a successful login as a settled session', () => {
    const state = authReducer(undefined, loginFulfilled(user));
    expect(state.validationStatus).toBe('succeeded');
    expect(state.isAuthenticated).toBe(true);
  });

  it('clears the validation hint on logout', () => {
    const signedIn = authReducer(undefined, loginFulfilled(user));
    const state = authReducer(signedIn, logout());
    expect(state.validationStatus).toBe('idle');
    expect(state.isAuthenticated).toBe(false);
    expect(state.validationErrorStatus).toBeNull();
  });
});
