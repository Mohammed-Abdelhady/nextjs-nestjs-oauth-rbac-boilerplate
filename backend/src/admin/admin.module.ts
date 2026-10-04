import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminUsersController } from './admin-users.controller';
import { AdminPermissionsController } from './admin-permissions.controller';
import { AdminUsersService } from './services/admin-users.service';
import { AdminUserCreateService } from './services/admin-user-create.service';
import { AdminUserQueriesService } from './services/admin-user-queries.service';
import { AdminUserAccessService } from './services/admin-user-access.service';
import { AdminEmailChangeService } from './services/admin-email-change.service';
import { AdminPermissionsService } from './services/admin-permissions.service';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Role, RoleSchema } from '../role/schemas/role.schema';
import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { SessionModule } from '../session/session.module';
import { RoleModule } from '../role/role.module';
import { UserModule } from '../user/user.module';

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
  ],
  exports: [AdminUsersService],
})
export class AdminModule {}
