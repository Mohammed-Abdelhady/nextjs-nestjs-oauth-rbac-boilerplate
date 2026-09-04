import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from './decorators/public.decorator';
import { AuthFeature } from './enums/auth-feature.enum';
import { AuthFeaturesService } from './services/auth-features.service';
import { AuthMethodsResponseDto } from './dto/auth-methods-response.dto';
import { OAuthRegistryService } from './oauth/oauth-registry.service';
import { ApiResponse } from '../common/dto/api-response.dto';

/**
 * What this deployment accepts as a sign-in. Registered in AppModule, which is
 * where both the auth configuration and the OAuth registry are in scope.
 */
@ApiTags('auth')
@Controller('auth')
export class AuthMethodsController {
  constructor(
    private readonly authFeaturesService: AuthFeaturesService,
    private readonly oauthRegistry: OAuthRegistryService,
  ) {}

  /**
   * List enabled sign-in methods
   * GET /api/auth/methods
   */
  @Public()
  @Get('methods')
  @ApiOperation({
    summary: 'List enabled sign-in methods',
    description:
      'Returns the password, magic link and two-factor switches together with ' +
      'the OAuth providers that have credentials, so a client renders only ' +
      'what works.',
  })
  getMethods(): ApiResponse<AuthMethodsResponseDto> {
    return ApiResponse.success({
      methods: {
        password: this.authFeaturesService.isEnabled(AuthFeature.PASSWORD),
        magicLink: this.authFeaturesService.isEnabled(AuthFeature.MAGIC_LINK),
        twoFactor: this.authFeaturesService.isEnabled(AuthFeature.TWO_FACTOR),
        oauth: this.oauthRegistry.listEnabled(),
      },
    });
  }
}
