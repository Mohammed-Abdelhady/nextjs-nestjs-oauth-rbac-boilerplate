import { DynamicModule, Module, Type, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth.module';
import { UserModule } from '../../user/user.module';
import { User, UserSchema } from '../../user/schemas/user.schema';
import { OAUTH_STRATEGIES } from './oauth.constants';
import { OAuthProviderStrategy } from './oauth-provider.interface';
import { OAuthController } from './oauth.controller';
import { OAuthRegistryService } from './oauth-registry.service';
import { OAuthRedirectService } from './oauth-redirect.service';
import { OAuthStateService } from './oauth-state.service';
import { OAuthService } from './oauth.service';
import { IsRegisteredProviderConstraint } from './validators/is-registered-provider.validator';

/**
 * OAuth provider registry.
 *
 * `OAuthModule.register([...])` is the only place that names concrete
 * providers; everything downstream resolves them through OAuthRegistryService.
 */
@Module({})
export class OAuthModule {
  static register(
    strategies: Type<OAuthProviderStrategy>[] = [],
  ): DynamicModule {
    return {
      module: OAuthModule,
      imports: [
        ConfigModule,
        MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
        forwardRef(() => AuthModule),
        forwardRef(() => UserModule),
      ],
      controllers: [OAuthController],
      providers: [
        ...strategies,
        {
          provide: OAUTH_STRATEGIES,
          useFactory: (
            ...resolved: OAuthProviderStrategy[]
          ): OAuthProviderStrategy[] => resolved,
          inject: strategies,
        },
        OAuthRegistryService,
        OAuthStateService,
        OAuthRedirectService,
        OAuthService,
        IsRegisteredProviderConstraint,
      ],
      exports: [
        OAUTH_STRATEGIES,
        OAuthRegistryService,
        OAuthStateService,
        OAuthService,
      ],
    };
  }
}
