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
  ],
})
export class UserModule {}
