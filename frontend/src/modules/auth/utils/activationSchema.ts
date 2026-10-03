import { z } from 'zod';
import {
  SIGNUP_NAME_MIN_LENGTH,
  SIGNUP_NAME_MAX_LENGTH,
  SIGNUP_NAME_PATTERN,
} from '../constants/authMethods';
import { createEmailCodeSchema } from './emailCodeSchema';
import { createPasswordSchema } from './passwordSchema';

export const createActivationSchema = (
  t: (key: string) => string,
  tPassword: (key: string) => string,
) =>
  createEmailCodeSchema(t)
    .extend({
      name: z
        .string({ required_error: t('errors.nameRequired') })
        .trim()
        .min(1, t('errors.nameRequired'))
        .regex(SIGNUP_NAME_PATTERN, t('errors.namePattern'))
        .refine(
          (value) => Array.from(value).length >= SIGNUP_NAME_MIN_LENGTH,
          t('errors.nameMinLength'),
        )
        .refine(
          (value) => Array.from(value).length <= SIGNUP_NAME_MAX_LENGTH,
          t('errors.nameMaxLength'),
        ),
      password: createPasswordSchema(tPassword),
      confirmPassword: z
        .string({ required_error: t('errors.confirmRequired') })
        .min(1, t('errors.confirmRequired')),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t('errors.passwordMismatch'),
      path: ['confirmPassword'],
    });
