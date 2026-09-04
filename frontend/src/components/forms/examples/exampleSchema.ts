/**
 * Schema for the generic form example.
 *
 * The validators carry no messages of their own, so every message is passed in.
 * A real form reads them from next-intl instead of the literals used here; this
 * file is reference material and is not wired into any route.
 */

import { z } from 'zod';
import {
  zodEmail,
  zodName,
  zodPassword,
  zodUrl,
  zodTextarea,
  zodBoolean,
  zodStringArray,
  zodEnum,
} from '@/lib/validations';

const BOOLEAN_MESSAGES = {
  required: 'This field is required',
  invalid: 'Must be true or false',
};

export const exampleSchema = z.object({
  // Text inputs
  name: zodName({
    required: true,
    messages: {
      required: 'Name is required',
      min: 'Name must be at least 2 characters',
      max: 'Name must not exceed 50 characters',
      pattern: 'Name can only contain letters, spaces, hyphens and apostrophes',
    },
  }),
  email: zodEmail({
    required: true,
    messages: {
      required: 'Email is required',
      invalid: 'Please enter a valid email address',
    },
  }),
  website: zodUrl({
    required: false,
    messages: {
      invalid: 'Please enter a valid URL',
      protocol: 'URL must start with http:// or https://',
    },
  }),

  // Password with complexity rules
  password: zodPassword({
    min: 8,
    messages: {
      required: 'Password is required',
      min: 'Password must be at least 8 characters',
      uppercase: 'Password must contain at least one uppercase letter',
      lowercase: 'Password must contain at least one lowercase letter',
      number: 'Password must contain at least one number',
    },
  }),

  // Select
  country: zodEnum(['us', 'ca', 'uk', 'au']),

  // Textarea
  bio: zodTextarea({
    min: 20,
    max: 500,
    messages: {
      required: 'Bio is required',
      min: 'Bio must be at least 20 characters',
      max: 'Bio must not exceed 500 characters',
    },
  }),

  // Single checkbox
  acceptTerms: zodBoolean({ messages: BOOLEAN_MESSAGES }).refine((val) => val === true, {
    message: 'You must accept the terms and conditions',
  }),

  // Checkbox group
  interests: zodStringArray.min(1, 'Select at least one interest'),

  // Radio buttons
  role: zodEnum(['user', 'admin', 'moderator']),

  // Switch
  notifications: zodBoolean({ messages: BOOLEAN_MESSAGES }),
});

export type ExampleFormValues = z.infer<typeof exampleSchema>;
