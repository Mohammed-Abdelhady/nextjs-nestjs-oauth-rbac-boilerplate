import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { Connection, Model } from 'mongoose';
import { RoleService } from '../../../src/role/role.service';
import { RoleEditService } from '../../../src/role/services/edit/role-edit.service';
import { Role, RoleSchema } from '../../../src/role/schemas/role.schema';
import { User } from '../../../src/user/schemas/user.schema';
import { SecurityEventService } from '../../../src/session/services/security-event.service';
import {
  SecurityEvent,
  SecurityEventDocument,
} from '../../../src/session/schemas/security-event.schema';
import { FrozenClock, TEST_NOW } from '../frozen-clock';
import {
  bootSessionAuthority,
  type SessionAuthorityHarness,
} from '../session-authority-harness';

export interface RoleEditHarness extends SessionAuthorityHarness {
  service: RoleService;
  roleModel: Model<Role>;
  events: Model<SecurityEventDocument>;
}

/** The session authority plus the role edit service on one database. */
export async function bootRoleEdit(mongoUri: string): Promise<RoleEditHarness> {
  const harness = await bootSessionAuthority(
    mongoUri,
    new FrozenClock(TEST_NOW),
  );
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      RoleService,
      RoleEditService,
      {
        provide: getModelToken(Role.name),
        inject: [getConnectionToken()],
        useFactory: (connection: Connection): Model<Role> =>
          connection.model(Role.name, RoleSchema),
      },
      { provide: getModelToken(User.name), useValue: harness.users },
      { provide: getConnectionToken(), useValue: harness.connection },
      {
        provide: SecurityEventService,
        useValue: harness.app.get(SecurityEventService),
      },
    ],
  }).compile();

  return Object.assign(harness, {
    service: module.get(RoleService),
    roleModel: module.get<Model<Role>>(getModelToken(Role.name)),
    events: harness.app.get<Model<SecurityEventDocument>>(
      getModelToken(SecurityEvent.name),
    ),
  });
}
