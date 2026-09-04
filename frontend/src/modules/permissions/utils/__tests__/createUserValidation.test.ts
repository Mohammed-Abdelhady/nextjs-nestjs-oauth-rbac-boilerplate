import { describe, expect, it } from 'vitest';
import { validateCreateUserForm } from '../createUserValidation';

const mockTranslator = (key: string): string => key;

describe('validateCreateUserForm', () => {
  it('returns errors for empty fields', () => {
    const errors = validateCreateUserForm(
      { email: '', name: '', password: '', role: '' },
      mockTranslator,
    );

    expect(errors.email).toBe('emailRequired');
    expect(errors.name).toBe('nameRequired');
    expect(errors.password).toBe('passwordRequired');
    expect(errors.role).toBe('roleRequired');
  });

  it('validates invalid email format', () => {
    const errors = validateCreateUserForm(
      { email: 'invalid-email', name: 'Valid Name', password: 'Password1!', role: 'user' },
      mockTranslator,
    );

    expect(errors.email).toBe('emailInvalid');
  });

  it('validates short name', () => {
    const errors = validateCreateUserForm(
      { email: 'user@example.com', name: 'A', password: 'Password1!', role: 'user' },
      mockTranslator,
    );

    expect(errors.name).toBe('nameMinLength');
  });

  it('validates short and weak passwords', () => {
    const shortErrors = validateCreateUserForm(
      { email: 'user@example.com', name: 'Valid Name', password: 'Pass1', role: 'user' },
      mockTranslator,
    );
    expect(shortErrors.password).toBe('passwordMinLength');

    const weakErrors = validateCreateUserForm(
      { email: 'user@example.com', name: 'Valid Name', password: 'passwordonly', role: 'user' },
      mockTranslator,
    );
    expect(weakErrors.password).toBe('passwordStrength');
  });

  it('returns empty errors object for valid input', () => {
    const errors = validateCreateUserForm(
      { email: 'user@example.com', name: 'Valid Name', password: 'Password1!', role: 'user' },
      mockTranslator,
    );

    expect(Object.keys(errors)).toHaveLength(0);
  });
});
