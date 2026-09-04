import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store/store';
import type { AuthState, User } from '../types/auth.types';
import { authApi } from './authApi';

/**
 * Initial authentication state
 * Note: Session managed via httpOnly cookies, no token in state
 */
const initialState: AuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

/**
 * Auth slice managing authentication state
 * Handles user data, loading states, and errors
 */
export const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    /**
     * Set authenticated user and mark as logged in
     */
    loginFulfilled: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },

    /**
     * Set user data (for activation flow)
     * Session managed via httpOnly cookie
     */
    setUser: (state, action: PayloadAction<User>) => {
      state.user = action.payload;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    },

    /**
     * Clear user session and mark as logged out
     * Backend will clear httpOnly cookie
     */
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    },

    /**
     * Set loading state for async operations
     */
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },

    /**
     * Set error message
     */
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
    },
  },
  extraReducers: (builder) => {
    // Handle login mutation lifecycle
    builder.addMatcher(authApi.endpoints.login.matchPending, (state) => {
      state.isLoading = true;
      state.error = null;
    });
    builder.addMatcher(authApi.endpoints.login.matchFulfilled, (state, action) => {
      state.user = action.payload.user;
      state.isAuthenticated = true;
      state.isLoading = false;
      state.error = null;
    });
    builder.addMatcher(authApi.endpoints.login.matchRejected, (state, action) => {
      state.isLoading = false;
      state.error = action.error.message || 'Login failed';
    });

    // Handle logout mutation lifecycle
    builder.addMatcher(authApi.endpoints.logout.matchFulfilled, (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.isLoading = false;
      state.error = null;
    });

    // Handle getCurrentUser query lifecycle
    builder.addMatcher(authApi.endpoints.getCurrentUser.matchFulfilled, (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    });
    builder.addMatcher(authApi.endpoints.getCurrentUser.matchRejected, (state) => {
      state.user = null;
      state.isAuthenticated = false;
    });
  },
});

// Export actions
export const { loginFulfilled, setUser, logout, setLoading, setError } = authSlice.actions;

// Selectors
export const selectUser = (state: RootState) => state.auth.user;
export const selectIsAuthenticated = (state: RootState) => state.auth.isAuthenticated;
export const selectAuthLoading = (state: RootState) => state.auth.isLoading;
export const selectAuthError = (state: RootState) => state.auth.error;

// Export reducer
export default authSlice.reducer;
