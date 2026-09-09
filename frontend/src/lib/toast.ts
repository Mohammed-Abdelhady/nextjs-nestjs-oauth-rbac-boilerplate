/**
 * Toast Utility Functions
 *
 * Wrapper around Sonner (shadcn toast component) with Redux integration
 * and i18n support. Provides type-safe toast functions with semantic colors.
 */

import type { ReactNode } from 'react';
import { toast as sonnerToast } from 'sonner';
import type { ExternalToast } from 'sonner';
import type { ToastType } from '@/types/toast.types';

/**
 * Toast options using Sonner's ExternalToast directly
 */
type ToastOptions = ExternalToast;

/**
 * Default durations for each toast type (in milliseconds)
 */
const DEFAULT_DURATIONS = {
  success: 4000,
  error: 5000,
  warning: 6000,
  info: 4000,
  loading: Infinity,
} as const;

/**
 * Show success toast notification
 */
export const success = (message: ReactNode, options?: ToastOptions): string | number => {
  return sonnerToast.success(message, {
    duration: options?.duration ?? DEFAULT_DURATIONS.success,
    ...options,
  });
};

/**
 * Show error toast notification
 */
export const error = (message: ReactNode, options?: ToastOptions): string | number => {
  return sonnerToast.error(message, {
    duration: options?.duration ?? DEFAULT_DURATIONS.error,
    ...options,
  });
};

/**
 * Show warning toast notification
 */
export const warning = (message: ReactNode, options?: ToastOptions): string | number => {
  return sonnerToast.warning(message, {
    duration: options?.duration ?? DEFAULT_DURATIONS.warning,
    ...options,
  });
};

/**
 * Show info toast notification
 */
export const info = (message: ReactNode, options?: ToastOptions): string | number => {
  return sonnerToast.info(message, {
    duration: options?.duration ?? DEFAULT_DURATIONS.info,
    ...options,
  });
};

/**
 * Show loading toast notification (must be manually dismissed or updated)
 */
export const loading = (message: ReactNode, options?: ToastOptions): string | number => {
  return sonnerToast.loading(message, {
    duration: options?.duration ?? DEFAULT_DURATIONS.loading,
    ...options,
  });
};

/**
 * Generic toast function that delegates to type-specific functions
 */
export const show = (
  type: ToastType,
  message: ReactNode,
  options?: ToastOptions,
): string | number => {
  switch (type) {
    case 'success':
      return success(message, options);
    case 'error':
      return error(message, options);
    case 'warning':
      return warning(message, options);
    case 'info':
      return info(message, options);
    case 'loading':
      return loading(message, options);
    default:
      return info(message, options);
  }
};

/**
 * Show toast for promise with loading/success/error states
 * Returns the toast ID with unwrap method
 */
export const promise = <T>(
  promise: Promise<T>,
  messages: {
    loading: string;
    success: string | ((data: T) => string);
    error: string | ((error: unknown) => string);
  },
) => {
  return sonnerToast.promise(promise, messages);
};

/**
 * Dismiss a specific toast by ID
 */
export const dismiss = (toastId?: string | number): void => {
  sonnerToast.dismiss(toastId);
};

/**
 * Dismiss all active toasts
 */
export const dismissAll = (): void => {
  sonnerToast.dismiss();
};

/**
 * Custom toast with full control (uses Sonner's base toast)
 */
export const custom = (message: ReactNode, options?: ToastOptions): string | number => {
  return sonnerToast(message, options);
};

/**
 * Export all toast functions as a single object
 */
export const toast = {
  success,
  error,
  warning,
  info,
  loading,
  show,
  promise,
  dismiss,
  dismissAll,
  custom,
};

/**
 * Re-export Sonner's toast for direct access if needed
 */
export { sonnerToast };
