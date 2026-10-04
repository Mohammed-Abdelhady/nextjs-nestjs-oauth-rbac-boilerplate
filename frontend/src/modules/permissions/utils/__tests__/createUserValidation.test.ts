import { describe, expect, it } from 'vitest';
import { validateCreateUserForm } from '../createUserValidation';

const mockTranslator = (key: string): string => key;

describe('validateCreateUserForm', () => {
  it('returns errors for empty fields', () => {
    const errors = validateCreateUserForm(
      { email: '', name: '', password: '', role: '' },
      mockTranslator,
      mockTranslator,
    );

    expect(errors.email).toBe('emailRequired');
    expect(errors.name).toBe('nameRequired');
    expect(errors.password).toBe('required');
    expect(errors.role).toBe('roleRequired');
  });

  it('validates invalid email format', () => {
    const errors = validateCreateUserForm(
      { email: 'invalid-email', name: 'Valid Name', password: 'Password1!', role: 'user' },
      mockTranslator,
      mockTranslator,
    );

    expect(errors.email).toBe('emailInvalid');
  });

  it('validates short name', () => {
    const errors = validateCreateUserForm(
      { email: 'user@example.com', name: 'A', password: 'Password1!', role: 'user' },
      mockTranslator,
      mockTranslator,
    );

    expect(errors.name).toBe('nameMinLength');
  });

  it('names the shared rule accepts', () => {
    for (const name of [
      'J.R.R. Tolkien',
      'Anne O\u2019Brien',
      '\u0623\u062d\u0645\u062f',
      '  John Doe  ',
    ]) {
      const errors = validateCreateUserForm(
        { email: 'user@example.com', name, password: 'Password1!', role: 'user' },
        mockTranslator,
        mockTranslator,
      );
      expect(errors.name).toBeUndefined();
    }
  });

  it('names the shared rule rejects, including invisible characters', () => {
    for (const name of [
      'Layla\tHaddad',
      'Bob\nAdmin',
      'Bo\ufeffb',
      '\u0301\u0301',
      '12',
      '<b>',
      'x'.repeat(101),
    ]) {
      const errors = validateCreateUserForm(
        { email: 'user@example.com', name, password: 'Password1!', role: 'user' },
        mockTranslator,
        mockTranslator,
      );
      expect(errors.name).toBeDefined();
    }
  });

  it('validates short and weak passwords', () => {
    const shortErrors = validateCreateUserForm(
      { email: 'user@example.com', name: 'Valid Name', password: 'Pass1', role: 'user' },
      mockTranslator,
      mockTranslator,
    );
    expect(shortErrors.password).toBe('min');

    const weakErrors = validateCreateUserForm(
      { email: 'user@example.com', name: 'Valid Name', password: 'passwordonly', role: 'user' },
      mockTranslator,
      mockTranslator,
    );
    expect(weakErrors.password).toBe('uppercase');
  });

  it('returns empty errors object for valid input', () => {
    const errors = validateCreateUserForm(
      { email: 'user@example.com', name: 'Valid Name', password: 'Password1!', role: 'user' },
      mockTranslator,
      mockTranslator,
    );

    expect(Object.keys(errors)).toHaveLength(0);
  });
});
