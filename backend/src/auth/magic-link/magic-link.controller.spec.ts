import { Test, TestingModule } from '@nestjs/testing';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { MagicLinkController } from './magic-link.controller';
import { MagicLinkService } from './magic-link.service';
import { FeatureEnabledGuard } from '../guards/feature-enabled.guard';
import { AuthFeaturesService } from '../services/auth-features.service';
import { MOCK_REQUEST, MOCK_RESPONSE } from './magic-link.harness-spec';

describe('MagicLinkController', () => {
  let controller: MagicLinkController;
  let magicLinkService: { request: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    magicLinkService = {
      request: jest.fn().mockResolvedValue({ success: true }),
      verify: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MagicLinkController],
      providers: [
        { provide: MagicLinkService, useValue: magicLinkService },
        // The class level guard is built with the controller, so its own
        // dependency has to resolve here too.
        {
          provide: AuthFeaturesService,
          useValue: { isEnabled: () => true, assertEnabled: () => undefined },
        },
      ],
    }).compile();

    controller = module.get<MagicLinkController>(MagicLinkController);
  });

  it('should pass the request along with the caller address and agent', async () => {
    await controller.request({ email: 'user@example.com' }, MOCK_REQUEST);

    expect(magicLinkService.request).toHaveBeenCalledWith(
      { email: 'user@example.com' },
      MOCK_REQUEST,
    );
  });

  it('should answer verify on the response that carries the session cookie', async () => {
    const json = jest.fn();
    const response = {
      ...MOCK_RESPONSE,
      status: jest.fn().mockReturnValue({ json }),
    } as unknown as typeof MOCK_RESPONSE;

    await controller.verify({ token: 'token' }, response);

    expect(magicLinkService.verify).toHaveBeenCalledWith(
      { token: 'token' },
      response,
    );
    expect(json).toHaveBeenCalledWith({ success: true });
  });

  it('should close every route behind the feature guard', () => {
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MagicLinkController,
    ) as unknown[];

    expect(guards).toContain(FeatureEnabledGuard);
  });
});
