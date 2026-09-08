/**
 * File Validators
 *
 * Collection of file upload validation schemas. Every message comes from the
 * caller so the schema reads in the active locale.
 *
 * @module lib/validations/file
 */

import { z } from 'zod';
import { makeOptional, createFileValidator } from '../utils';

interface FileTypeMessages {
  size: string;
  type: string;
}

/**
 * Generic file validator with size and type limits
 */
export const zodFile = (options: {
  required?: boolean;
  maxSize?: number;
  messages: {
    required: string;
    empty: string;
    size: string;
  };
}) => {
  const { maxSize } = options;

  let schema = z.instanceof(File, { message: options.messages.required });

  schema = schema.refine((file) => file.size > 0, options.messages.empty);

  if (maxSize) {
    schema = schema.refine((file) => file.size <= maxSize, options.messages.size);
  }

  return makeOptional(schema, options.required);
};

/**
 * Image file validator (JPG, PNG, WebP, max 5MB)
 */
export const zodImage = (options: {
  required?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  messages: FileTypeMessages;
}) =>
  createFileValidator(5_000_000, ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'], options);

/**
 * Document file validator (PDF, DOCX, max 10MB)
 */
export const zodDocument = (options: {
  required?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  messages: FileTypeMessages;
}) =>
  createFileValidator(
    10_000_000,
    [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
    ],
    options,
  );

/**
 * Multiple files validator factory
 */
export const zodMultipleFiles = (options: {
  maxFiles?: number;
  minFiles?: number;
  fileValidator?: z.ZodType<File>;
  messages: {
    min: string;
    max: string;
  };
}) => {
  const fileSchema = options.fileValidator ?? z.instanceof(File);

  return z
    .array(fileSchema)
    .min(options.minFiles ?? 1, options.messages.min)
    .max(options.maxFiles ?? 10, options.messages.max);
};
