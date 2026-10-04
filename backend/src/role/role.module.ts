import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleSweepBootstrapService } from './services/role-sweep-bootstrap.service';
import { RoleEditService } from './services/role-edit.service';
import { RoleHierarchyService } from './services/role-hierarchy.service';
import { Role, RoleSchema } from './schemas/role.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { SessionModule } from '../session/session.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule, // Session services used by the global AuthGuard
    CommonModule, // Required for RolesGuard
    SessionModule, // Security event recording for role edits
  ],
  controllers: [RoleController],
  providers: [
    RoleService,
    RoleEditService,
    RoleHierarchyService,
    RoleSweepBootstrapService,
  ],
  exports: [RoleService, RoleHierarchyService],
})
export class RoleModule {}
