/**
 * Global Form Styles Configuration (Semantic Color System)
 * ==========================================================
 *
 * This file provides centralized styling for all form components using semantic
 * color tokens from globals.css. All colors automatically adapt to theme changes.
 *
 * ## Architecture
 *
 * Token-based composition system with three layers:
 * 1. **TOKENS**: Atomic design tokens (semantic colors, spacing, typography)
 * 2. **BASE_COMPOSITIONS**: Pre-composed style groups shared across components
 * 3. **FORM_STYLES**: Final component styles built from compositions
 *
 * ## Semantic Color System
 *
 * All color tokens use semantic names that automatically theme:
 * - `bg-input` - Form field backgrounds (adapts to light/dark)
 * - `border-border` - Field borders (adapts to light/dark)
 * - `bg-primary` - Primary brand color
 * - `text-foreground` - Primary text color
 *
 * See docs/color-system.md for complete token reference.
 *
 * ## How to Customize
 *
 * ### Change Visual Design (affects all components)
 * ```typescript
 * // Update in globals.css instead of here:
 * // :root { --input: 220 13% 91%; }
 * ```
 *
 * ### Override Per Instance
 * ```tsx
 * <FormInput className="h-20 px-8" />  // Instance-specific override
 * ```
 */

import { FOCUS_RING_CLASSES } from '@/constants/focusStyles';

/**
 * Atomic design tokens - semantic color system
 *
 * All color tokens use semantic names from globals.css CSS variables.
 * This enables automatic theme switching without dark: variants.
 *
 * Token Mapping (old hardcoded → new semantic):
 * - bg: bg-gray-100 dark:bg-gray-800 → bg-input
 * - bgFocus: focus:bg-white dark:focus:bg-gray-900 → focus:bg-background
 * - border: border-gray-200 dark:border-gray-700 → border-border
 * - borderFocus: focus:border-gray-400 dark:focus:border-gray-600 → focus:border-ring
 * - placeholder: placeholder-gray-500 dark:placeholder-gray-400 → placeholder-muted-foreground
 * - buttonPrimaryBg: bg-indigo-500 dark:bg-indigo-600 → bg-primary
 * - buttonPrimaryBgHover: hover:bg-indigo-700 → hover:opacity-90
 * - buttonPrimaryText: text-gray-100 → text-primary-foreground
 * - buttonSecondaryBg: bg-indigo-100 dark:bg-indigo-900 → bg-secondary
 * - buttonSecondaryBgHover: hover:shadow → hover:bg-secondary/80
 * - buttonSecondaryText: text-gray-800 dark:text-gray-200 → text-secondary-foreground
 *
 * @see frontend/src/app/globals.css for CSS variable definitions
 * @see docs/color-system.md for complete semantic token guide
 */
const TOKENS = {
  // Semantic color palette
  colors: {
    bg: 'bg-input',
    bgFocus: 'focus:bg-background',
    border: 'border-border',
    borderFocus: 'focus:border-ring',
    placeholder: 'placeholder-muted-foreground',
  },

  // Spacing & layout
  spacing: {
    width: 'w-full',
    borderRadius: 'rounded-lg',
  },

  // Typography
  typography: {
    fontSize: 'text-sm',
    fontWeight: 'font-medium',
  },

  // Component-specific dimensions
  input: {
    height: 'h-14',
    padding: 'px-5',
  },

  textarea: {
    minHeight: 'min-h-30',
    padding: 'px-5 py-3',
    resize: 'resize-none',
  },

  // State styles
  states: {
    border: 'border',
    focusRing: FOCUS_RING_CLASSES,
    transition: 'transition-all duration-300 ease-in-out',
  },
} as const;

/**
 * Pre-composed style groups to eliminate repetition
 */
const BASE_COMPOSITIONS = {
  // Shared by both input and textarea
  formField: [
    TOKENS.spacing.width,
    TOKENS.spacing.borderRadius,
    TOKENS.typography.fontWeight,
    TOKENS.colors.bg,
    TOKENS.states.border,
    TOKENS.colors.border,
    TOKENS.colors.placeholder,
    TOKENS.typography.fontSize,
    TOKENS.states.focusRing,
    TOKENS.colors.borderFocus,
    TOKENS.colors.bgFocus,
  ],
} as const;

/**
 * Final composed styles for components
 */
export const FORM_STYLES = {
  input: {
    base: [...BASE_COMPOSITIONS.formField, TOKENS.input.height, TOKENS.input.padding].join(' '),
  },

  textarea: {
    base: [
      ...BASE_COMPOSITIONS.formField,
      TOKENS.textarea.minHeight,
      TOKENS.textarea.padding,
      TOKENS.textarea.resize,
    ].join(' '),
  },

  container: 'space-y-2',
} as const;

/**
 * Generic helper to build className strings
 */
const buildClassName = (baseClass: string, additionalClasses?: string): string => {
  return additionalClasses ? [baseClass, additionalClasses].join(' ') : baseClass;
};

/**
 * Helper functions for applying form styles
 */
export const getInputClassName = (additionalClasses?: string): string =>
  buildClassName(FORM_STYLES.input.base, additionalClasses);

export const getTextareaClassName = (additionalClasses?: string): string =>
  buildClassName(FORM_STYLES.textarea.base, additionalClasses);
