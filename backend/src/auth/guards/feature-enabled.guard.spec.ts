import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { FeatureEnabledGuard } from './feature-enabled.guard';
import { AuthFeaturesService } from '../services/auth-features.service';
import { AuthFeature } from '../enums/auth-feature.enum';
import { AUTH_FEATURE_KEY } from '../decorators/requires-feature.decorator';
import { AuthController } from '../auth.controller';
import { MagicLinkController } from '../magic-link/magic-link.controller';
import { ErrorCode } from '../../common/enums/error-code.enum';

class UngatedController {
  handle(): void {}
}

type RouteHandler = (...args: never[]) => unknown;

/** Route handler as a plain function, which is what carries the metadata. */
function handlerOf(prototype: object, name: string): RouteHandler {
  return (prototype as unknown as Record<string, RouteHandler>)[name];
}

/** Context that reports the class and handler a request would have hit. */
function contextFor(
  target: object,
  handler: RouteHandler = () => undefined,
): ExecutionContext {
  return {
    getClass: () => target,
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

describe('FeatureEnabledGuard', () => {
  function createGuard(enabled: Record<AuthFeature, boolean>): {
    guard: FeatureEnabledGuard;
  } {
    const configService = {
      get: jest.fn((key: string) =>
        key === 'auth.passwordEnabled'
          ? enabled[AuthFeature.PASSWORD]
          : enabled[AuthFeature.MAGIC_LINK],
      ),
    };

    const guard = new FeatureEnabledGuard(
      new Reflector(),
      new AuthFeaturesService(
        configService as unknown as ConstructorParameters<
          typeof AuthFeaturesService
        >[0],
      ),
    );

    return { guard };
  }

  it('should let a route without feature metadata through', () => {
    const { guard } = createGuard({
      [AuthFeature.PASSWORD]: false,
      [AuthFeature.MAGIC_LINK]: false,
    });

    expect(guard.canActivate(contextFor(UngatedController))).toBe(true);
  });

  it('should let the magic link routes through when the method is on', () => {
    const { guard } = createGuard({
      [AuthFeature.PASSWORD]: true,
      [AuthFeature.MAGIC_LINK]: true,
    });

    expect(guard.canActivate(contextFor(MagicLinkController))).toBe(true);
  });

  it('should answer 404 FEATURE_DISABLED for the magic link routes when the method is off', () => {
    const { guard } = createGuard({
      [AuthFeature.PASSWORD]: true,
      [AuthFeature.MAGIC_LINK]: false,
    });

    expect(() => guard.canActivate(contextFor(MagicLinkController))).toThrow(
      expect.objectContaining({
        code: ErrorCode.FEATURE_DISABLED,
        status: 404,
      }) as Error,
    );
  });

  it('should answer 404 FEATURE_DISABLED for login when passwords are off', () => {
    const { guard } = createGuard({
      [AuthFeature.PASSWORD]: false,
      [AuthFeature.MAGIC_LINK]: true,
    });

    expect(() =>
      guard.canActivate(
        contextFor(
          AuthController,
          handlerOf(AuthController.prototype, 'login'),
        ),
      ),
    ).toThrow(
      expect.objectContaining({ code: ErrorCode.FEATURE_DISABLED }) as Error,
    );
  });
});

describe('password route gating', () => {
  const reflector = new Reflector();

  it.each(['register', 'login', 'forgotPassword', 'resetPassword'])(
    'should tie %s to the password method',
    (handler) => {
      expect(
        reflector.get(
          AUTH_FEATURE_KEY,
          handlerOf(AuthController.prototype, handler),
        ),
      ).toBe(AuthFeature.PASSWORD);
    },
  );

  it.each(['activate', 'resendActivation', 'logout'])(
    'should leave %s open, since it does not need a password',
    (handler) => {
      expect(
        reflector.get(
          AUTH_FEATURE_KEY,
          handlerOf(AuthController.prototype, handler),
        ),
      ).toBeUndefined();
    },
  );

  it('should tie the whole magic link controller to the magic link method', () => {
    expect(reflector.get(AUTH_FEATURE_KEY, MagicLinkController)).toBe(
      AuthFeature.MAGIC_LINK,
    );
  });
});
