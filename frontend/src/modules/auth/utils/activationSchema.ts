import { z } from 'zod';
import { zodEmail } from '@/lib/validations';

/**
 * Activation form validation schema
 */
export const createActivationSchema = (t: (key: string) => string) =>
  z.object({
    email: zodEmail({
      required: true,
      messages: {
        required: t('errors.emailRequired'),
        invalid: t('errors.emailInvalid'),
      },
    }),
    code: z
      .string({ required_error: t('errors.codeRequired') })
      .trim()
      .length(6, t('errors.codeLength'))
      .regex(/^\d{6}$/, t('errors.codeInvalid')),
  });

export type ActivationFormData = z.infer<ReturnType<typeof createActivationSchema>>;
