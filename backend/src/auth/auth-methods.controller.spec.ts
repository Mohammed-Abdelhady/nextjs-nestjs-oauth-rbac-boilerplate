import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AuthMethodsController } from './auth-methods.controller';
import { AuthFeaturesService } from './services/auth-features.service';
import { OAuthRegistryService } from './oauth/oauth-registry.service';

describe('AuthMethodsController', () => {
  const providers = [{ id: 'google', displayName: 'Google' }];

  async function createController(config: {
    passwordEnabled: boolean;
    magicLinkEnabled: boolean;
    twoFactorEnabled: boolean;
  }): Promise<AuthMethodsController> {
    const values: Record<string, boolean> = {
      'auth.passwordEnabled': config.passwordEnabled,
      'magicLink.enabled': config.magicLinkEnabled,
      'twoFactor.enabled': config.twoFactorEnabled,
    };

    const configService = {
      get: jest.fn((key: string, fallback?: boolean) =>
        key in values ? values[key] : fallback,
      ),
    } as unknown as ConfigService;

    const registry = {
      listEnabled: jest.fn().mockReturnValue(providers),
    } as unknown as OAuthRegistryService;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthMethodsController],
      providers: [
        AuthFeaturesService,
        { provide: ConfigService, useValue: configService },
        { provide: OAuthRegistryService, useValue: registry },
      ],
    }).compile();

    return module.get<AuthMethodsController>(AuthMethodsController);
  }

  it('should report both credential methods and the configured providers', async () => {
    const controller = await createController({
      passwordEnabled: true,
      magicLinkEnabled: true,
      twoFactorEnabled: true,
    });

    expect(controller.getMethods()).toEqual({
      success: true,
      data: {
        methods: {
          password: true,
          magicLink: true,
          twoFactor: true,
          oauth: providers,
        },
      },
      message: undefined,
    });
  });

  it('should leave out a method the deployment turned off', async () => {
    const controller = await createController({
      passwordEnabled: false,
      magicLinkEnabled: true,
      twoFactorEnabled: false,
    });

    expect(controller.getMethods().data.methods).toMatchObject({
      password: false,
      magicLink: true,
      twoFactor: false,
    });
  });
});
