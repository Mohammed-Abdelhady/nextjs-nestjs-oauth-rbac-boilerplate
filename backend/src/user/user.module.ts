import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserProfileController } from './user-profile.controller';
import { UserSessionsController } from './user-sessions.controller';
import { UserProvidersController } from './user-providers.controller';
import { UserProfileService } from './services/user-profile.service';
import { UserSessionsService } from './services/user-sessions.service';
import { UserPermissionsService } from './services/user-permissions.service';
import { User, UserSchema } from './schemas/user.schema';
import { Session, SessionSchema } from '../session/schemas/session.schema';
import { Role, RoleSchema } from '../role/schemas/role.schema';
import {
  Passkey,
  PasskeySchema,
} from '../auth/passkeys/schemas/passkey.schema';
import { SessionService } from '../auth/services/session.service';
import { AccountLinkingService } from './services/account-linking.service';
import { ProfileSyncService } from './services/profile-sync.service';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Role.name, schema: RoleSchema },
      // The profile reports how many passkeys the account holds.
      { name: Passkey.name, schema: PasskeySchema },
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [
    UserProfileController,
    UserSessionsController,
    UserProvidersController,
  ],
  providers: [
    UserProfileService,
    UserSessionsService,
    UserPermissionsService,
    SessionService,
    AccountLinkingService,
    ProfileSyncService,
  ],
  exports: [
    MongooseModule,
    UserProfileService,
    UserSessionsService,
    UserPermissionsService,
    AccountLinkingService,
    ProfileSyncService,
  ],
})
export class UserModule {}
