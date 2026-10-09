import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RoleController } from './role.controller';
import { RoleService } from './role.service';
import { RoleSweepBootstrapService } from './services/bootstrap/role-sweep-bootstrap.service';
import { RoleEditService } from './services/edit/role-edit.service';
import { RoleHierarchyService } from './services/role-hierarchy.service';
import { Role, RoleSchema } from './schemas/role.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';
import { CommonModule } from '../common/common.module';
import { SessionModule } from '../session/session.module';
import { RoleCatalogStore } from './stores/role-catalog.store';
import { RoleChangeStore } from './stores/role-change.store';
import { RoleSweepStore } from './stores/role-sweep.store';
import { MongoRoleCatalogStore } from './persistence/mongo/mongo-role-catalog.store';
import { MongoRoleChangeStore } from './persistence/mongo/mongo-role-change.store';
import { MongoRoleSweepStore } from './persistence/mongo/mongo-role-sweep.store';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule, // Session services used by the global AuthGuard
    CommonModule, // Required for RolesGuard
    SessionModule, // Security events and the unit of work for role edits
  ],
  controllers: [RoleController],
  providers: [
    RoleService,
    RoleEditService,
    RoleHierarchyService,
    RoleSweepBootstrapService,
    { provide: RoleCatalogStore, useClass: MongoRoleCatalogStore },
    { provide: RoleChangeStore, useClass: MongoRoleChangeStore },
    { provide: RoleSweepStore, useClass: MongoRoleSweepStore },
  ],
  exports: [RoleService, RoleHierarchyService, RoleChangeStore, RoleSweepStore],
})
export class RoleModule {}
