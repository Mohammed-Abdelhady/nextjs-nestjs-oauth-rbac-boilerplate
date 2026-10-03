import { MIN_PASSWORD_LENGTH, zodPassword } from '@app/core';

export function createPasswordSchema(t: (key: string) => string) {
  return zodPassword({
    required: true,
    min: MIN_PASSWORD_LENGTH,
    messages: {
      required: t('required'),
      min: t('min'),
      uppercase: t('uppercase'),
      lowercase: t('lowercase'),
      number: t('number'),
      tooLong: t('tooLong'),
    },
  });
}
