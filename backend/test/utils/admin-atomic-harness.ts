import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { AdminUsersService } from '../../src/admin/services/admin-users.service';
import { AdminUserCreateService } from '../../src/admin/services/admin-user-create.service';
import { AdminUserAccessService } from '../../src/admin/services/admin-user-access.service';
import { AdminEmailChangeService } from '../../src/admin/services/admin-email-change.service';
import { RoleHierarchyService } from '../../src/role/services/role-hierarchy.service';
import { RoleService } from '../../src/role/role.service';
import { RoleEditService } from '../../src/role/services/role-edit.service';
import { Role, RoleSchema } from '../../src/role/schemas/role.schema';
import { User } from '../../src/user/schemas/user.schema';
import { SessionService } from '../../src/auth/services/session.service';
import { SecurityEventService } from '../../src/session/services/security-event.service';
import {
  SecurityEvent,
  SecurityEventDocument,
} from '../../src/session/schemas/security-event.schema';
import { partialMock } from '../../src/common/testing/test-doubles.harness-spec';
import { FrozenClock, TEST_NOW } from './frozen-clock';
import {
  bootSessionAuthority,
  type SessionAuthorityHarness,
} from './session-authority-harness';

export interface AdminAtomicHarness extends SessionAuthorityHarness {
  service: AdminUsersService;
  createService: AdminUserCreateService;
  roles: RoleService;
  roleModel: Model<Role>;
  events: Model<SecurityEventDocument>;
}

/** The session authority plus the admin and role services on one database. */
export async function bootAdminAtomic(
  mongoUri: string,
): Promise<AdminAtomicHarness> {
  const harness = await bootSessionAuthority(
    mongoUri,
    new FrozenClock(TEST_NOW),
  );
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      AdminUsersService,
      AdminUserCreateService,
      AdminUserAccessService,
      RoleHierarchyService,
      RoleService,
      RoleEditService,
      { provide: getModelToken(User.name), useValue: harness.users },
      {
        provide: getModelToken(Role.name),
        inject: [getConnectionToken()],
        useFactory: (connection: Connection): Model<Role> =>
          connection.model(Role.name, RoleSchema),
      },
      { provide: getConnectionToken(), useValue: harness.connection },
      { provide: SessionService, useValue: harness.sessionService },
      {
        provide: SecurityEventService,
        useValue: harness.app.get(SecurityEventService),
      },
      {
        provide: AdminEmailChangeService,
        useValue: partialMock<AdminEmailChangeService>(),
      },
    ],
  }).compile();

  const roleModel = module.get<Model<Role>>(getModelToken(Role.name));
  await roleModel.init();

  return Object.assign(harness, {
    service: module.get(AdminUsersService),
    createService: module.get(AdminUserCreateService),
    roles: module.get(RoleService),
    roleModel,
    events: harness.app.get<Model<SecurityEventDocument>>(
      getModelToken(SecurityEvent.name),
    ),
  });
}
