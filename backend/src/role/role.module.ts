import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleHierarchyService } from './services/role-hierarchy.service';
import { Role, RoleSchema } from './schemas/role.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule, // Session services used by the global AuthGuard
    CommonModule, // Required for RolesGuard
  ],
  controllers: [RoleController],
  providers: [RoleService, RoleHierarchyService],
  exports: [RoleService, RoleHierarchyService],
})
export class RoleModule {}
