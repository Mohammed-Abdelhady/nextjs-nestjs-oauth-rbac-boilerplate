// feature:totp:start
// The two-factor module reaches the otplib adapter; this spec only reads
// module metadata.
jest.mock('../two-factor/utils/totp.util', () => ({
  generateTotpSecret: jest.fn(),
  buildOtpauthUrl: jest.fn(),
  checkTotpDelta: jest.fn(),
}));
// feature:totp:end

import { MODULE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { PasskeysModule } from './passkeys.module';
import { PasskeysController } from './passkeys.controller';
import { PasskeyLoginController } from './passkey-login.controller';
import { PasskeyAssertionService } from './services/passkey-assertion.service';
import { PasskeyLoginService } from './services/passkey-login.service';
import { PasskeyManagementService } from './services/passkey-management.service';
import { PasskeyRegistrationService } from './services/passkey-registration.service';
import { PasskeySecondFactorVerifier } from './services/passkey-second-factor.verifier';
import { WebAuthnAdapter } from './services/webauthn.adapter';
import { AuthModule } from '../auth.module';
import { TwoFactorModule } from '../two-factor/two-factor.module'; // feature:totp
import { AUTH_FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { AuthFeature } from '../enums/auth-feature.enum';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * The part of the boot check that does not need a database: the module
 * carrying its own routes, the one-way link to the second factor, and the
 * feature metadata that closes the routes when passkeys are off.
 */

function metadataOf(module: object, key: string): unknown[] {
  return (Reflect.getMetadata(key, module) as unknown[] | undefined) ?? [];
}

type RouteHandler = (...args: never[]) => unknown;

function handlerOf(prototype: object, name: string): RouteHandler {
  return (prototype as unknown as Record<string, RouteHandler>)[name];
}

describe('Passkeys wiring', () => {
  const reflector = new Reflector();

  it('registers both controllers in the module', () => {
    const controllers = metadataOf(PasskeysModule, MODULE_METADATA.CONTROLLERS);

    expect(controllers).toContain(PasskeysController);
    expect(controllers).toContain(PasskeyLoginController);
  });

  it.each([
    ['WebAuthnAdapter', WebAuthnAdapter],
    ['PasskeyRegistrationService', PasskeyRegistrationService],
    ['PasskeyAssertionService', PasskeyAssertionService],
    ['PasskeyLoginService', PasskeyLoginService],
    ['PasskeyManagementService', PasskeyManagementService],
    ['PasskeySecondFactorVerifier', PasskeySecondFactorVerifier],
  ])('provides %s', (_name, provider) => {
    expect(metadataOf(PasskeysModule, MODULE_METADATA.PROVIDERS)).toContain(
      provider,
    );
  });

  it('takes sessions and the feature switch from AuthModule', () => {
    expect(metadataOf(PasskeysModule, MODULE_METADATA.IMPORTS)).toContain(
      AuthModule,
    );
  });

  it.each([
    ['PasskeyAssertionService', PasskeyAssertionService],
    ['PasskeySecondFactorVerifier', PasskeySecondFactorVerifier],
  ])('hands %s to the features that ask for it', (_name, provider) => {
    expect(metadataOf(PasskeysModule, MODULE_METADATA.EXPORTS)).toContain(
      provider,
    );
  });

  // feature:totp:start
  it('links to the second factor one way', () => {
    expect(metadataOf(TwoFactorModule, MODULE_METADATA.IMPORTS)).toContain(
      PasskeysModule,
    );
    expect(metadataOf(PasskeysModule, MODULE_METADATA.IMPORTS)).not.toContain(
      TwoFactorModule,
    );
  });
  // feature:totp:end

  it.each([
    ['management', PasskeysController],
    ['sign-in', PasskeyLoginController],
  ])('ties the %s routes to the passkey method', (_name, controller) => {
    expect(reflector.get(AUTH_FEATURE_KEY, controller)).toBe(
      AuthFeature.PASSKEYS,
    );
  });

  it.each(['options', 'verify'])(
    'leaves the sign-in route %s open, since there is no session yet',
    (handler) => {
      expect(
        reflector.get(
          IS_PUBLIC_KEY,
          handlerOf(PasskeyLoginController.prototype, handler),
        ),
      ).toBe(true);
    },
  );

  it.each(['registerOptions', 'registerVerify', 'list', 'rename', 'remove'])(
    'keeps %s behind a session',
    (handler) => {
      expect(
        reflector.get(
          IS_PUBLIC_KEY,
          handlerOf(PasskeysController.prototype, handler),
        ),
      ).toBeUndefined();
    },
  );
});
