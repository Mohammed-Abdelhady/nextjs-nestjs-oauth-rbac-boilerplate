import {
  IsString,
  registerDecorator,
  ValidationOptions,
} from 'class-validator';
import type { TransformFnParams } from 'class-transformer';
import type { ValidationArguments } from 'class-validator';
import {
  NAME_HAS_LETTER_REGEX,
  NAME_LENGTH_MESSAGE,
  NAME_MAX_LENGTH,
  NAME_MESSAGE,
  NAME_MIN_LENGTH,
  NAME_NO_LETTER_MESSAGE,
  NAME_REGEX,
  NAME_REQUIRED_MESSAGE,
  NAME_TYPE_MESSAGE,
} from '../constants/name';

// Read the raw body because implicit conversion runs before this transform.
export function transformTrimmedName({ obj, key }: TransformFnParams): unknown {
  const raw: unknown = obj?.[key];
  return typeof raw === 'string' ? raw.trim().normalize('NFC') : raw;
}

/** Validates the trimmed NFC value, matching shared/core zodName. */
export function NamePolicy(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    IsString({
      message: ({ value }: ValidationArguments) =>
        value === null || value === undefined
          ? NAME_REQUIRED_MESSAGE
          : NAME_TYPE_MESSAGE,
    })(object, propertyName);
    registerDecorator({
      name: 'namePolicy',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          if (typeof value !== 'string') {
            return true;
          }
          const length = Array.from(value).length;
          if (length < NAME_MIN_LENGTH || length > NAME_MAX_LENGTH) {
            return false;
          }
          return NAME_REGEX.test(value) && NAME_HAS_LETTER_REGEX.test(value);
        },
        defaultMessage(arguments_: ValidationArguments): string {
          const value = arguments_.value;
          if (typeof value !== 'string') {
            return NAME_LENGTH_MESSAGE;
          }
          if (value.length === 0) {
            return NAME_REQUIRED_MESSAGE;
          }
          const length = Array.from(value).length;
          if (length < NAME_MIN_LENGTH || length > NAME_MAX_LENGTH) {
            return NAME_LENGTH_MESSAGE;
          }
          if (!NAME_REGEX.test(value)) {
            return NAME_MESSAGE;
          }
          return NAME_NO_LETTER_MESSAGE;
        },
      },
    });
  };
}
