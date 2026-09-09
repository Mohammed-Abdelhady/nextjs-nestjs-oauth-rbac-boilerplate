import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth.module';
import { MagicLinkController } from './magic-link.controller';
import { MagicLinkService } from './magic-link.service';
import {
  PendingMagicLink,
  PendingMagicLinkSchema,
} from './schemas/pending-magic-link.schema';
import { User, UserSchema } from '../../user/schemas/user.schema';
import { Role, RoleSchema } from '../../role/schemas/role.schema';

/**
 * Passwordless sign-in. Sessions, mail and the feature switch come from
 * AuthModule, so this module can be dropped without touching the rest of auth.
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PendingMagicLink.name, schema: PendingMagicLinkSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
  ],
  controllers: [MagicLinkController],
  providers: [MagicLinkService],
  exports: [MagicLinkService],
})
export class MagicLinkModule {}
