import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminUsersController } from './admin-users.controller';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminUsersService } from './services/users/admin-users.service';
import { AdminUserCreateService } from './services/users/admin-user-create.service';
import { AdminUserQueriesService } from './services/users/admin-user-queries.service';
import { AdminUserAccessService } from './services/users/admin-user-access.service';
import { AdminEmailChangeService } from './services/users/admin-email-change.service';
import { AdminPermissionsService } from './services/roles/admin-permissions.service';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Role, RoleSchema } from '../role/schemas/role.schema';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { SessionModule } from '../session/session.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';
import { MONGO_ADMIN_ACCOUNT_STORE } from './persistence/mongo/mongo-admin-stores';

/**
 * Admin module for user management operations.
 * Provides endpoints for listing, viewing, updating and deleting users, plus
 * direct permission grants.
 */
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    AuthModule,
    SessionModule,
    MailModule,
    RoleModule,
    forwardRef(() => UserModule),
  ],
  controllers: [AdminUsersController, AdminPermissionsController],
  providers: [
    AdminUsersService,
    AdminUserCreateService,
    AdminUserQueriesService,
    AdminUserAccessService,
    AdminEmailChangeService,
    AdminPermissionsService,
    MONGO_ADMIN_ACCOUNT_STORE,
  ],
  exports: [AdminUsersService],
})
export class AdminModule {}
