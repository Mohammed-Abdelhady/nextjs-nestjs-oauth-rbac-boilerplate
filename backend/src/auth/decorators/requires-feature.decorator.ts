import { SetMetadata, UseGuards, applyDecorators } from '@nestjs/common';
import { AuthFeature } from '../enums/auth-feature.enum';
import { FeatureEnabledGuard } from '../guards/feature-enabled.guard';

export const AUTH_FEATURE_KEY = 'authFeature';

/**
 * Ties a route or a controller to a sign-in method. When the deployment has
 * that method off, the route answers 404 with FEATURE_DISABLED.
 */
export function RequiresFeature(
  feature: AuthFeature,
): ClassDecorator & MethodDecorator {
  return applyDecorators(
    SetMetadata(AUTH_FEATURE_KEY, feature),
    UseGuards(FeatureEnabledGuard),
  );
}
