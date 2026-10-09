import { Connection, Model } from 'mongoose';
import {
  RerunPause,
  UnitOfWork,
  UnitOfWorkRunner,
} from '../../../common/persistence/unit-of-work';
import {
  MongoUnitOfWorkRunner,
  mongoUnitOfWork,
} from '../../../session/persistence/mongo/mongo-unit-of-work';
import { SecurityEventService } from '../../../session/services/security-event.service';
import { withMajorityTransaction } from '../../../session/utils/transactions/mongo-transaction';
import { UserDocument } from '../../../user/schemas/user.schema';
import { RoleDocument } from '../../schemas/role.schema';
import { RoleSweepStores } from '../../sweeps/role-holder-sweep';
import { MongoRoleCatalogStore } from './mongo-role-catalog.store';
import { MongoRoleChangeStore } from './mongo-role-change.store';
import { MongoRoleSweepStore } from './mongo-role-sweep.store';

export interface MongoRoleModels {
  roleModel: Model<RoleDocument>;
  userModel: Model<UserDocument>;
  connection: Connection;
  events: SecurityEventService;
}

export interface MongoRoleStores extends RoleSweepStores {
  catalog: MongoRoleCatalogStore;
}

/** The MongoDB role stores over the given models, wired by hand. */
export function mongoRoleStores(
  models: MongoRoleModels,
  pause?: RerunPause,
): MongoRoleStores {
  const { roleModel, userModel, connection, events } = models;
  return {
    runner: new MongoUnitOfWorkRunner(connection, pause),
    catalog: new MongoRoleCatalogStore(roleModel, userModel),
    changes: new MongoRoleChangeStore(roleModel, userModel, events),
    sweeps: new MongoRoleSweepStore(roleModel, userModel, events),
  };
}

/**
 * Runs work in a transaction and lets the driver's own errors through, for
 * callers outside the role module that still read them. It goes away when
 * those callers move behind a store.
 */
export class MongoDriverErrorRunner extends UnitOfWorkRunner {
  constructor(private readonly connection: Connection) {
    super();
  }

  run<Result>(
    work: (unitOfWork: UnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    return withMajorityTransaction(this.connection, (session) =>
      work(mongoUnitOfWork(session)),
    );
  }
}
