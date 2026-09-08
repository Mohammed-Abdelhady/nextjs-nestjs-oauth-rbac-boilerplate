import { Injectable } from '@nestjs/common';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  registerDecorator,
} from 'class-validator';
import { EMAIL_PROVIDER } from '../../../common/constants/oauth-providers';
import { OAuthRegistryService } from '../oauth-registry.service';

export interface RegisteredProviderOptions {
  /** Accept 'email' alongside the registered OAuth providers. */
  allowEmail?: boolean;
}

/**
 * Validates a provider id against the OAuth registry at request time, so no DTO
 * carries a hardcoded provider list.
 */
@ValidatorConstraint({ name: 'isRegisteredProvider', async: false })
@Injectable()
export class IsRegisteredProviderConstraint implements ValidatorConstraintInterface {
  constructor(private readonly registry?: OAuthRegistryService) {}

  validate(value: unknown, args: ValidationArguments): boolean {
    if (typeof value !== 'string' || !this.registry) {
      return false;
    }

    const [options] = args.constraints as [RegisteredProviderOptions?];
    if (options?.allowEmail && value === EMAIL_PROVIDER) {
      return true;
    }

    return this.registry.has(value);
  }

  defaultMessage(args: ValidationArguments): string {
    if (!this.registry) {
      return `${args.property} could not be validated: the OAuth registry is unavailable`;
    }

    const [options] = args.constraints as [RegisteredProviderOptions?];
    const allowed = options?.allowEmail
      ? [EMAIL_PROVIDER, ...this.registry.getIds()]
      : this.registry.getIds();

    return `${args.property} must be one of: ${allowed.join(', ')}`;
  }
}

export function IsRegisteredProvider(
  options: RegisteredProviderOptions = {},
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return function registerIsRegisteredProvider(
    target: object,
    propertyName: string | symbol,
  ): void {
    registerDecorator({
      target: target.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: [options],
      validator: IsRegisteredProviderConstraint,
    });
  };
}
