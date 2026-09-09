import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserProfileController } from './user-profile.controller';
import { UserSessionsController } from './user-sessions.controller';
import { UserProvidersController } from './user-providers.controller'; // feature:oauth-core
import { UserProfileService } from './services/user-profile.service';
import { UserSessionsService } from './services/user-sessions.service';
import { UserPermissionsService } from './services/user-permissions.service';
import { User, UserSchema } from './schemas/user.schema';
import { Session, SessionSchema } from '../session/schemas/session.schema';
import { Role, RoleSchema } from '../role/schemas/role.schema';
// feature:passkeys:start
import {
  Passkey,
  PasskeySchema,
} from '../auth/passkeys/schemas/passkey.schema';
// feature:passkeys:end
import { SessionService } from '../auth/services/session.service';
import { AccountLinkingService } from './services/account-linking.service'; // feature:oauth-core
import { ProfileSyncService } from './services/profile-sync.service'; // feature:oauth-core
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Role.name, schema: RoleSchema },
      // feature:passkeys:start
      // The profile reports how many passkeys the account holds.
      { name: Passkey.name, schema: PasskeySchema },
      // feature:passkeys:end
    ]),
    forwardRef(() => AuthModule),
  ],
  controllers: [
    UserProfileController,
    UserSessionsController,
    UserProvidersController, // feature:oauth-core
  ],
  providers: [
    UserProfileService,
    UserSessionsService,
    UserPermissionsService,
    SessionService,
    AccountLinkingService, // feature:oauth-core
    ProfileSyncService, // feature:oauth-core
  ],
  exports: [
    MongooseModule,
    UserProfileService,
    UserSessionsService,
    UserPermissionsService,
    AccountLinkingService, // feature:oauth-core
    ProfileSyncService, // feature:oauth-core
  ],
})
export class UserModule {}
