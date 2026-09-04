import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthFeature } from '../enums/auth-feature.enum';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

/** Configuration key holding the switch for each method. */
const FEATURE_CONFIG_KEYS: Record<AuthFeature, string> = {
  [AuthFeature.PASSWORD]: 'auth.passwordEnabled',
  [AuthFeature.MAGIC_LINK]: 'magicLink.enabled',
};

/** Used when the key is absent, which happens in tests with a partial config. */
const FEATURE_FALLBACKS: Record<AuthFeature, boolean> = {
  [AuthFeature.PASSWORD]: true,
  [AuthFeature.MAGIC_LINK]: false,
};

/**
 * Single answer to "is this sign-in method on?", read by the guard that closes
 * the routes and by the discovery endpoint that lists them.
 */
@Injectable()
export class AuthFeaturesService {
  constructor(private readonly configService: ConfigService) {}

  isEnabled(feature: AuthFeature): boolean {
    return this.configService.get<boolean>(
      FEATURE_CONFIG_KEYS[feature],
      FEATURE_FALLBACKS[feature],
    );
  }

  /**
   * @throws AppException FEATURE_DISABLED with a 404, so a deployment that
   * turned the method off looks like one that never had the route
   */
  assertEnabled(feature: AuthFeature): void {
    if (this.isEnabled(feature)) {
      return;
    }

    throw new AppException(
      ErrorCode.FEATURE_DISABLED,
      'This sign-in method is not available',
      HttpStatus.NOT_FOUND,
      { feature },
    );
  }
}
