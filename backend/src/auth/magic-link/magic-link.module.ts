import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth.module';
import { MagicLinkController } from './magic-link.controller';
import { MagicLinkService } from './magic-link.service';
import { CommonModule } from '../../common/common.module';
import {
  MAGIC_LINK_PERSISTENCE_IMPORTS,
  MAGIC_LINK_PERSISTENCE_PROVIDERS,
} from './persistence/magic-link-persistence';

/**
 * Passwordless sign-in. Sessions, mail and the feature switch come from
 * AuthModule, so this module can be dropped without touching the rest of auth.
 */
@Module({
  imports: [
    CommonModule,
    ConfigModule,
    ...MAGIC_LINK_PERSISTENCE_IMPORTS,
    AuthModule,
  ],
  controllers: [MagicLinkController],
  providers: [MagicLinkService, ...MAGIC_LINK_PERSISTENCE_PROVIDERS],
  exports: [MagicLinkService],
})
export class MagicLinkModule {}
