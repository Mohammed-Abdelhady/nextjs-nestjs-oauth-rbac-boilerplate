import { ConfigService } from '@nestjs/config';
import { AuthFeature } from '../enums/auth-feature.enum';
import { AuthFeaturesService } from './auth-features.service';

jest.mock('../constants/available-auth-features', () => ({
  AVAILABLE_AUTH_FEATURES: new Set(['password']),
}));

describe('AuthFeaturesService in a generated project', () => {
  it('should refuse removed methods even when their runtime flag is on', () => {
    const config = { get: jest.fn().mockReturnValue(true) };
    const service = new AuthFeaturesService(config as unknown as ConfigService);

    for (const feature of [
      AuthFeature.MAGIC_LINK,
      AuthFeature.TWO_FACTOR,
      AuthFeature.PASSKEYS,
    ]) {
      expect(service.isEnabled(feature)).toBe(false);
      expect(() => service.assertEnabled(feature)).toThrow(
        'This sign-in method is not available',
      );
    }
    expect(config.get).not.toHaveBeenCalled();
  });

  it.each([true, false])(
    'should respect a retained method flag of %s',
    (enabled) => {
      const config = { get: jest.fn().mockReturnValue(enabled) };
      const service = new AuthFeaturesService(
        config as unknown as ConfigService,
      );

      expect(service.isEnabled(AuthFeature.PASSWORD)).toBe(enabled);
      expect(config.get).toHaveBeenCalledWith('auth.passwordEnabled', true);
    },
  );
});
