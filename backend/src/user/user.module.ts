import { CommonModule } from '../common/common.module';
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
import { AccountLinkingService } from './services/account-linking.service'; // feature:oauth-core
import { ProfileSyncService } from './services/profile-sync.service'; // feature:oauth-core
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';
import { MONGO_ACCOUNT_STORES } from './persistence/mongo/mongo-account-stores';
import { MONGO_LINKED_ACCOUNT_STORE } from './persistence/mongo/mongo-linked-account-stores'; // feature:oauth-core
import { AccountSessions } from './stores/account-sessions';

@Module({
  imports: [
    CommonModule,
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
    SessionModule,
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
    AccountLinkingService, // feature:oauth-core
    ProfileSyncService, // feature:oauth-core
    ...MONGO_ACCOUNT_STORES,
    MONGO_LINKED_ACCOUNT_STORE, // feature:oauth-core
  ],
  exports: [
    MongooseModule,
    AccountSessions,
    UserProfileService,
    UserSessionsService,
    UserPermissionsService,
    AccountLinkingService, // feature:oauth-core
    ProfileSyncService, // feature:oauth-core
  ],
})
export class UserModule {}
