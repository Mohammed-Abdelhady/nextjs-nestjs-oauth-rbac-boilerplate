/**
 * Error Interceptor Middleware
 *
 * Redux middleware that intercepts RTK Query errors and automatically
 * triggers toast notifications with intelligent error classification.
 *
 * EXECUTION ORDER: Must run AFTER RTK Query middleware to access error metadata
 */

import { isRejectedWithValue, type Middleware } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';
import { toast } from '@/lib/toast';
import type { ToastType } from '@/types/toast.types';
import { STATUS_CODE_MESSAGES, ERROR_MESSAGES, TOAST_DURATION } from '@/constants/toastMessages';

/**
 * Check if error should be silent (no toast)
 */
const isSilentError = (error: FetchBaseQueryError): boolean => {
  // Silent all 401 errors (unauthorized is expected when not authenticated)
  if (error.status === 401) {
    return true;
  }

  // User-cancelled requests (AbortError)
  if ('name' in error && error.name === 'AbortError') {
    return true;
  }

  // CORS preflight requests
  if (error.status === 'PARSING_ERROR') {
    return true;
  }

  return false;
};

/**
 * Classify error and determine toast type and duration
 */
const classifyError = (
  error: FetchBaseQueryError,
): { type: ToastType; duration: number } | null => {
  const status = typeof error.status === 'number' ? error.status : 0;

  // Critical server errors - require manual dismissal
  if (status === 500 || status === 503) {
    return { type: 'error', duration: TOAST_DURATION.CRITICAL_ERROR };
  }

  // Network errors - longer duration for user to check connectivity
  if (!status || error.status === 'FETCH_ERROR') {
    return { type: 'error', duration: 10000 };
  }

  // Timeout errors
  if (status === 408 || status === 504) {
    return { type: 'error', duration: 8000 };
  }

  // Client errors - standard duration
  if (status >= 400 && status < 500) {
    return { type: 'error', duration: TOAST_DURATION.ERROR };
  }

  return { type: 'error', duration: TOAST_DURATION.ERROR };
};

/**
 * Extract user-friendly error message from error object
 */
const getErrorMessage = (error: FetchBaseQueryError): string => {
  const status = typeof error.status === 'number' ? error.status : 0;

  // Check if error has custom message in response data
  if (error.data && typeof error.data === 'object') {
    const data = error.data as {
      message?: string;
      error?: string | { code?: string; message?: string };
    };

    // Check for direct message field
    if (data.message && typeof data.message === 'string') {
      return data.message;
    }

    // Check for nested error object (backend format: { error: { code, message } })
    if (data.error) {
      if (typeof data.error === 'string') {
        return data.error;
      }
      if (typeof data.error === 'object' && data.error.message) {
        return data.error.message;
      }
    }
  }

  // Network errors
  if (!status || error.status === 'FETCH_ERROR') {
    return ERROR_MESSAGES.NETWORK_ERROR;
  }

  // Timeout errors
  if (status === 408 || status === 504) {
    return ERROR_MESSAGES.TIMEOUT_ERROR;
  }

  // Use status code mapping
  if (STATUS_CODE_MESSAGES[status]) {
    return STATUS_CODE_MESSAGES[status];
  }

  // Fallback to generic error
  return ERROR_MESSAGES.UNKNOWN_ERROR;
};

/**
 * Extract endpoint name from RTK Query meta
 */
const getEndpointName = (action: unknown): string | undefined => {
  const typedAction = action as { meta?: { arg?: unknown } };
  const arg = typedAction.meta?.arg as { endpointName?: string } | undefined;
  return arg?.endpointName;
};

/**
 * Extract HTTP method from RTK Query meta
 */
const getHttpMethod = (action: unknown): string | undefined => {
  const typedAction = action as { meta?: { baseQueryMeta?: unknown } };
  const baseQueryMeta = typedAction.meta?.baseQueryMeta as
    | { request?: { method?: string } }
    | undefined;
  const originalArgs = baseQueryMeta?.request?.method;
  return originalArgs || 'GET';
};

/**
 * Error interceptor middleware
 *
 * Catches all RTK Query rejected actions and triggers toasts automatically.
 * Uses deduplication in toast slice to prevent spam.
 */
export const errorInterceptor: Middleware = () => (next) => (action) => {
  // Check if action is a rejected RTK Query action
  if (isRejectedWithValue(action)) {
    const error = action.payload as FetchBaseQueryError;
    const endpoint = getEndpointName(action);
    const method = getHttpMethod(action);

    // Skip silent errors
    if (isSilentError(error)) {
      return next(action);
    }

    // Classify error
    const classification = classifyError(error);
    if (!classification) {
      return next(action);
    }

    // Get user-friendly message
    const message = getErrorMessage(error);

    // Show toast notification using Sonner
    toast.show(classification.type, message, {
      duration: classification.duration,
      description: endpoint ? `Failed to ${method} ${endpoint}` : undefined,
    });
  }

  // Continue processing action
  return next(action);
};
