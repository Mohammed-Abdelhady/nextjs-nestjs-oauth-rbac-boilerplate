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
import { CommonModule } from '../../common/common.module';
import { MagicLinkStore } from './stores/magic-link.store';
import {
  MagicLinkAccounts,
  MagicLinkSignIn,
} from './stores/magic-link-accounts';
import { MongoMagicLinkStore } from './persistence/mongo/mongo-magic-link.store';
import {
  MongoMagicLinkAccounts,
  MongoMagicLinkSignIn,
} from './persistence/mongo/mongo-magic-link-accounts';

/**
 * Passwordless sign-in. Sessions, mail and the feature switch come from
 * AuthModule, so this module can be dropped without touching the rest of auth.
 */
@Module({
  imports: [
    CommonModule,
    ConfigModule,
    MongooseModule.forFeature([
      { name: PendingMagicLink.name, schema: PendingMagicLinkSchema },
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
  ],
  controllers: [MagicLinkController],
  providers: [
    MagicLinkService,
    { provide: MagicLinkStore, useClass: MongoMagicLinkStore },
    { provide: MagicLinkAccounts, useClass: MongoMagicLinkAccounts },
    { provide: MagicLinkSignIn, useClass: MongoMagicLinkSignIn },
  ],
  exports: [MagicLinkService],
})
export class MagicLinkModule {}
