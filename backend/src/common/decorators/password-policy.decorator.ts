import { registerDecorator, ValidationOptions } from 'class-validator';
import {
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  PASSWORD_REQUIREMENTS_MESSAGE,
} from '../constants/password';

const UPPERCASE = /[A-Z]/;
const LOWERCASE = /[a-z]/;
const DIGIT = /\d/;
const UTF8_ENCODER = new TextEncoder();

/**
 * The one password rule: at least PASSWORD_MIN_LENGTH characters, an uppercase
 * letter, a lowercase letter and a number, and at most PASSWORD_MAX_BYTES
 * UTF-8 bytes (the part bcrypt reads). Every password DTO uses this decorator
 * so no two paths can disagree about the credential.
 */
export function PasswordPolicy(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'passwordPolicy',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return true;
          }
          return (
            value.length >= PASSWORD_MIN_LENGTH &&
            UTF8_ENCODER.encode(value).length <= PASSWORD_MAX_BYTES &&
            UPPERCASE.test(value) &&
            LOWERCASE.test(value) &&
            DIGIT.test(value)
          );
        },
        defaultMessage(): string {
          return PASSWORD_REQUIREMENTS_MESSAGE;
        },
      },
    });
  };
}
