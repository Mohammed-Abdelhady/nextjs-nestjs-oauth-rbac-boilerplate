import { createPasswordSchema } from '@/modules/auth/utils/passwordSchema';
import { zodName, type NameMessages } from '@app/core';

export interface CreateUserFormValues {
  email: string;
  name: string;
  password: string;
  role: string;
}

export type ValidationTranslator = (key: string) => string;

/**
 * The messages the shared name rule reads for the admin forms. The keys are
 * the ones the create/edit user dialogs already use.
 */
export function nameMessagesFor(t: ValidationTranslator): NameMessages {
  return {
    required: t('nameRequired'),
    min: t('nameMinLength'),
    max: t('nameMaxLength'),
    pattern: t('namePattern'),
    noLetter: t('nameNoLetter'),
  };
}

/**
 * Validates inputs for the create user modal.
 *
 * @param values - Form field values
 * @param t - Translation function for validation messages
 * @returns Record of field errors keyed by field name
 */
export function validateCreateUserForm(
  values: CreateUserFormValues,
  t: ValidationTranslator,
  tPassword: ValidationTranslator,
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.email.trim()) {
    errors.email = t('emailRequired');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = t('emailInvalid');
  }

  const nameResult = zodName({
    required: true,
    messages: nameMessagesFor(t),
  }).safeParse(values.name);
  if (!nameResult.success) {
    errors.name = nameResult.error.issues[0].message;
  }

  const passwordResult = createPasswordSchema(tPassword).safeParse(values.password);
  if (!passwordResult.success) {
    errors.password = passwordResult.error.issues[0].message;
  }

  if (!values.role) {
    errors.role = t('roleRequired');
  }

  return errors;
}
