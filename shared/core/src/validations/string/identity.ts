/**
 * Identity String Validators
 *
 * Email, password and name rules behind the auth and account forms. Every
 * message comes from the caller so the schema reads in the active locale.
 *
 * @module validations/string/identity
 */

import { z } from 'zod';
import { makeOptional } from '../utils';
import { isPasswordWithinByteLimit } from '../../password-rules';

export interface EmailMessages {
  required: string;
  invalid: string;
}

export interface PasswordMessages {
  required: string;
  min: string;
  uppercase: string;
  lowercase: string;
  number: string;
  /** Localized "too long" text; falls back to a default when omitted. */
  tooLong?: string;
}

/** Fallback used when a caller has not localized the byte-limit message yet. */
const DEFAULT_PASSWORD_TOO_LONG_MESSAGE = 'Password is too long';

/** The refined password schema, so the overloads match what is returned. */
type RefinedPasswordSchema = z.ZodEffects<z.ZodString, string, string>;

export interface NameMessages {
  required: string;
  min: string;
  max: string;
  pattern: string;
}

/**
 * Email validator (RFC 5322 compliant)
 * Returns required schema by default, optional when required: false
 */
export function zodEmail(options: {
  required?: false;
  messages: EmailMessages;
}): z.ZodOptional<z.ZodString>;
export function zodEmail(options: { required: true; messages: EmailMessages }): z.ZodString;
export function zodEmail(options: {
  required?: boolean;
  messages: EmailMessages;
}): z.ZodString | z.ZodOptional<z.ZodString>;
export function zodEmail(options: { required?: boolean; messages: EmailMessages }) {
  const schema = z
    .string({ required_error: options.messages.required })
    .trim()
    .toLowerCase()
    .min(1, options.messages.required)
    .email(options.messages.invalid);

  if (options.required === false) {
    return schema.optional();
  }
  return schema;
}

/**
 * Password validator (min 8 chars, uppercase, lowercase, number)
 * Returns required schema by default, optional when required: false
 */
export function zodPassword(options: {
  required?: false;
  min?: number;
  messages: PasswordMessages;
}): z.ZodOptional<RefinedPasswordSchema>;
export function zodPassword(options: {
  required: true;
  min?: number;
  messages: PasswordMessages;
}): RefinedPasswordSchema;
export function zodPassword(options: {
  required?: boolean;
  min?: number;
  messages: PasswordMessages;
}): RefinedPasswordSchema | z.ZodOptional<RefinedPasswordSchema>;
export function zodPassword(options: {
  required?: boolean;
  min?: number;
  messages: PasswordMessages;
}) {
  const schema = z
    .string({ required_error: options.messages.required })
    .min(1, options.messages.required)
    .min(options.min ?? 8, options.messages.min)
    .regex(/[A-Z]/, options.messages.uppercase)
    .regex(/[a-z]/, options.messages.lowercase)
    .regex(/\d/, options.messages.number)
    .refine((value) => isPasswordWithinByteLimit(value), {
      message: options.messages.tooLong ?? DEFAULT_PASSWORD_TOO_LONG_MESSAGE,
    });

  if (options.required === false) {
    return schema.optional();
  }
  return schema;
}

/**
 * Person name validator (2-50 chars, letters, spaces, hyphens, apostrophes)
 * Returns required schema by default, optional when required: false
 */
export function zodName(options: {
  required?: false;
  min?: number;
  max?: number;
  messages: NameMessages;
}): z.ZodOptional<z.ZodString>;
export function zodName(options: {
  required: true;
  min?: number;
  max?: number;
  messages: NameMessages;
}): z.ZodString;
export function zodName(options: {
  required?: boolean;
  min?: number;
  max?: number;
  messages: NameMessages;
}): z.ZodString | z.ZodOptional<z.ZodString> {
  const schema = z
    .string({ required_error: options.messages.required })
    .trim()
    .min(1, options.messages.required)
    .min(options.min ?? 2, options.messages.min)
    .max(options.max ?? 50, options.messages.max)
    .regex(/^[\p{L}\s'-]+$/u, options.messages.pattern);

  return makeOptional(schema, options.required);
}

/**
 * Username validator (3-20 alphanumeric + underscore)
 */
export const zodUsername = (options: {
  required?: boolean;
  min?: number;
  max?: number;
  messages: {
    min: string;
    max: string;
    pattern: string;
  };
}) => {
  const schema = z
    .string()
    .trim()
    .toLowerCase()
    .min(options.min ?? 3, options.messages.min)
    .max(options.max ?? 20, options.messages.max)
    .regex(/^[a-z0-9_]+$/, options.messages.pattern);

  return makeOptional(schema, options.required);
};
