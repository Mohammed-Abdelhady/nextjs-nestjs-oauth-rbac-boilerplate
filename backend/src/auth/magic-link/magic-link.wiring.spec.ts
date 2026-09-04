import { MODULE_METADATA } from '@nestjs/common/constants';
import { MagicLinkModule } from './magic-link.module';
import { MagicLinkController } from './magic-link.controller';
import { MagicLinkService } from './magic-link.service';
import { AuthModule } from '../auth.module';
import { AuthMailService } from '../services/auth-mail.service';
import { AuthFeaturesService } from '../services/auth-features.service';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import { FeatureEnabledGuard } from '../guards/feature-enabled.guard';

/**
 * The part of the boot check that does not need a database: the magic link
 * module carrying its own routes, and AuthModule handing out everything that
 * module and its guard resolve through the parent injector.
 */

function metadataOf(module: object, key: string): unknown[] {
  return (Reflect.getMetadata(key, module) as unknown[] | undefined) ?? [];
}

describe('Magic link wiring', () => {
  it('registers the routes and the service in the module', () => {
    expect(metadataOf(MagicLinkModule, MODULE_METADATA.CONTROLLERS)).toContain(
      MagicLinkController,
    );
    expect(metadataOf(MagicLinkModule, MODULE_METADATA.PROVIDERS)).toContain(
      MagicLinkService,
    );
  });

  it('takes sessions, mail and the feature switch from AuthModule', () => {
    expect(metadataOf(MagicLinkModule, MODULE_METADATA.IMPORTS)).toContain(
      AuthModule,
    );
  });

  it.each([
    ['AuthMailService', AuthMailService],
    ['AuthFeaturesService', AuthFeaturesService],
    ['SessionService', SessionService],
    ['SessionCookieService', SessionCookieService],
    ['FeatureEnabledGuard', FeatureEnabledGuard],
  ])('exports %s from AuthModule', (_name, provider) => {
    expect(metadataOf(AuthModule, MODULE_METADATA.EXPORTS)).toContain(provider);
  });
});
