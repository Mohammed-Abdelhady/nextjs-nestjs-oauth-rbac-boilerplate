/**
 * String Validators
 *
 * Split by purpose: identity rules for the auth forms, free text rules for
 * long-form fields, and pattern rules for formats checked with a regex.
 *
 * @module lib/validations/string
 */

export * from './identity';
export * from './text';
export * from './patterns';
