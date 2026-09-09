export interface CreateUserFormValues {
  email: string;
  name: string;
  password: string;
  role: string;
}

export type ValidationTranslator = (key: string) => string;

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
): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!values.email.trim()) {
    errors.email = t('emailRequired');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    errors.email = t('emailInvalid');
  }

  if (!values.name.trim()) {
    errors.name = t('nameRequired');
  } else if (values.name.trim().length < 2) {
    errors.name = t('nameMinLength');
  }

  if (!values.password) {
    errors.password = t('passwordRequired');
  } else if (values.password.length < 8) {
    errors.password = t('passwordMinLength');
  } else if (
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/.test(values.password)
  ) {
    errors.password = t('passwordStrength');
  }

  if (!values.role) {
    errors.role = t('roleRequired');
  }

  return errors;
}
