import { ValidationError, ValidationPipe } from '@nestjs/common';
import { ValidationTypes } from 'class-validator';
import {
  ValidationFailedException,
  ValidationLogSummary,
} from '../exceptions/validation-failed.exception';

const FIELD_PATH_SEPARATOR = '.';

/** Most field names one log line carries. */
export const MAX_LOGGED_FIELD_NAMES = 20;

/** A path built from DTO property names and array indexes, and nothing else. */
const LOGGABLE_FIELD_PATH = /^[A-Za-z0-9_.]{1,100}$/;

type FailedProperty = (
  path: string,
  constraints: Record<string, string>,
) => void;

function visitFailedProperties(
  errors: ValidationError[],
  parentPath: string,
  visit: FailedProperty,
): void {
  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}${FIELD_PATH_SEPARATOR}${error.property}`
      : error.property;
    if (error.constraints && Object.keys(error.constraints).length > 0) {
      visit(path, error.constraints);
    }
    visitFailedProperties(error.children ?? [], path, visit);
  }
}

/**
 * Messages of a failed validation, keyed by the DTO property that failed.
 * A nested object or array element is a dotted path: `address.city`, `items.0.name`.
 */
export function collectValidationFields(
  errors: ValidationError[],
): Record<string, string[]> {
  // A map, so a property named `__proto__` stays an ordinary key.
  const fields = new Map<string, string[]>();
  visitFailedProperties(errors, '', (path, constraints) => {
    fields.set(path, [
      ...(fields.get(path) ?? []),
      ...Object.values(constraints),
    ]);
  });
  return Object.fromEntries(fields);
}

/**
 * The failed properties a log line may name. The name of a property the DTO
 * does not declare is text the caller chose, so it is counted and not named.
 */
export function summarizeValidationFields(
  errors: ValidationError[],
): ValidationLogSummary {
  const fieldNames = new Set<string>();
  let omittedCount = 0;
  visitFailedProperties(errors, '', (path, constraints) => {
    const isLoggable =
      !(ValidationTypes.WHITELIST in constraints) &&
      LOGGABLE_FIELD_PATH.test(path);
    if (isLoggable && fieldNames.size < MAX_LOGGED_FIELD_NAMES) {
      fieldNames.add(path);
      return;
    }
    omittedCount += 1;
  });
  return { fieldNames: [...fieldNames], omittedCount };
}

export function validationExceptionFactory(
  errors: ValidationError[],
): ValidationFailedException {
  return new ValidationFailedException(
    collectValidationFields(errors),
    summarizeValidationFields(errors),
  );
}

/** The global validation pipe, shared by the server and the e2e application. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true, // Strip unknown properties
    forbidNonWhitelisted: true, // Throw error if unknown properties
    transform: true, // Transform to DTO instances
    transformOptions: {
      enableImplicitConversion: true,
    },
    exceptionFactory: validationExceptionFactory,
  });
}
