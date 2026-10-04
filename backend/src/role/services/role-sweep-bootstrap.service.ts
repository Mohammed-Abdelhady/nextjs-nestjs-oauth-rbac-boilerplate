import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Role, RoleDocument } from '../schemas/role.schema';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { UserRole } from '../../user/enums/user-role.enum';
import { SecurityEventService } from '../../session/services/security-event.service';
import { LINEARIZABLE_QUERY_MAX_TIME_MS } from '../../session/constants/session-policy';
import {
  ROLE_PENDING_SWEEP_LIMIT,
  ROLE_SWEEP_BOOTSTRAP_BUDGET_MS,
  ROLE_SWEEP_BOOTSTRAP_BUDGET_EXHAUSTED,
  ROLE_SWEEP_BOOTSTRAP_FAILED,
  ROLE_SWEEP_BOOTSTRAP_FINISHED,
  ROLE_SWEEP_BOOTSTRAP_LIMIT,
} from '../../common/constants/roles';
import { repairPendingRoleSweeps } from '../utils/role-pending-sweep.util';
import { Clock } from '../../common/services/clock';
import { describeDriverError } from '../../common/utils/mongo-error.util';

@Injectable()
export class RoleSweepBootstrapService
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(RoleSweepBootstrapService.name);
  private task: Promise<void> = Promise.resolve();
  private stopping = false;

  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly events: SecurityEventService,
    private readonly clock: Clock,
  ) {}

  onApplicationBootstrap(): void {
    this.stopping = false;
    const deadline =
      this.clock.now().getTime() + ROLE_SWEEP_BOOTSTRAP_BUDGET_MS;
    this.task = this.repair(deadline)
      .catch((error: unknown) => {
        this.logger.error({
          event: ROLE_SWEEP_BOOTSTRAP_FAILED,
          error: describeDriverError(error),
        });
      })
      .finally(() => {
        this.logger.debug({ event: ROLE_SWEEP_BOOTSTRAP_FINISHED });
      });
  }

  async onApplicationShutdown(): Promise<void> {
    this.stopping = true;
    await this.task;
  }

  private async repair(deadline: number): Promise<void> {
    let budgetLogged = false;
    const shouldStop = (): boolean => {
      if (this.stopping) return true;
      if (this.clock.now().getTime() < deadline) return false;
      if (!budgetLogged) {
        budgetLogged = true;
        this.logger.warn({
          event: ROLE_SWEEP_BOOTSTRAP_BUDGET_EXHAUSTED,
          budgetMs: ROLE_SWEEP_BOOTSTRAP_BUDGET_MS,
        });
      }
      return true;
    };
    const owners = await this.roleModel
      .find({ 'pendingHolderSweeps.0': { $exists: true } })
      .sort({ updatedAt: 1, _id: 1 })
      .limit(ROLE_SWEEP_BOOTSTRAP_LIMIT)
      .maxTimeMS(LINEARIZABLE_QUERY_MAX_TIME_MS)
      .exec();
    const attempted = new Set<string>();
    for (const owner of owners) {
      if (shouldStop()) return;
      for (const ref of owner.pendingHolderSweeps.slice(
        0,
        ROLE_PENDING_SWEEP_LIMIT,
      ))
        attempted.add(`${ref.roleId.toString()}:${ref.previousSlug}`);
      await repairPendingRoleSweeps({
        connection: this.connection,
        roleModel: this.roleModel,
        userModel: this.userModel,
        events: this.events,
        ownerId: owner._id,
        refs: owner.pendingHolderSweeps.slice(0, ROLE_PENDING_SWEEP_LIMIT),
        logger: this.logger,
        shouldStop,
      });
      if (shouldStop()) return;
      // Rotate owners that still have pending work behind older unattempted owners.
      await this.roleModel.updateOne(
        { _id: owner._id, 'pendingHolderSweeps.0': { $exists: true } },
        { $set: { updatedAt: this.clock.now() } },
        { timestamps: false },
      );
    }
    if (shouldStop()) return;
    // Delete references also survive a crash before the default role can record them.
    const deleted = await this.events.pendingRoleDeletions(
      ROLE_SWEEP_BOOTSTRAP_LIMIT,
    );
    if (deleted.length === 0 || shouldStop()) return;
    const fallback = await this.roleModel
      .findOne({ slug: UserRole.USER })
      .exec();
    if (!fallback)
      throw new Error('Default role is missing during startup repair');
    for (const ref of deleted) {
      if (shouldStop()) return;
      if (attempted.has(`${ref.roleId}:${ref.previousSlug}`)) continue;
      const roleId = new Types.ObjectId(ref.roleId);
      await repairPendingRoleSweeps({
        connection: this.connection,
        roleModel: this.roleModel,
        userModel: this.userModel,
        events: this.events,
        ownerId: fallback._id,
        refs: [{ ...ref, roleId }],
        recorded: fallback.pendingHolderSweeps.some((pending) =>
          pending.roleId.equals(roleId),
        ),
        logger: this.logger,
        shouldStop,
      });
    }
  }
}
