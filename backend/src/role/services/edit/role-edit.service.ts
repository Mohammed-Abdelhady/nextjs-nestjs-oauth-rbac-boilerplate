import { randomUUID } from 'crypto';
import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Error as MongooseError, Model, Types } from 'mongoose';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import {
  isDatabaseUnavailableError,
  isMongoDuplicateKeyError,
} from '../../../common/utils/mongo-error.util';
import { withMajorityTransaction } from '../../../session/utils/transactions/mongo-transaction';
import { asAuthorityUnavailable } from '../../../session/utils/authority/authority-unavailable';
import { SecurityEventService } from '../../../session/services/security-event.service';
import { ROLE_PENDING_SWEEP_LIMIT } from '../../../common/constants/roles';
import { ROLE_PERMISSIONS } from '../../../common/constants/permissions';
import { assertFreshRolePermission } from '../../utils/role-actor.util';
import { moveRoleHolders } from '../../utils/holder-sweeps/role-holder.util';
import { repairPendingRoleSweeps } from '../../utils/holder-sweeps/role-pending-sweep.util';
import { UserRole } from '../../../user/enums/user-role.enum';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import {
  PendingRoleSweep,
  Role,
  RoleDocument,
} from '../../schemas/role.schema';
import { UpdateRoleDto } from '../../dto/update-role.dto';
import {
  dedupePermissions,
  generateSlug,
  samePermissions,
} from '../../utils/role.util';

interface RoleEditOutcome {
  role: RoleDocument;
  usersMoved: number;
  previousSlug: string;
  nextSlug: string;
  renamed: boolean;
}

/**
 * The transactional half of a role rename or permission edit: the role document
 * and every holder's sessions move together, and one security event is recorded
 * per affected holder.
 */
@Injectable()
export class RoleEditService {
  private readonly logger = new Logger(RoleEditService.name);
  constructor(
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectConnection() private readonly connection: Connection,
    private readonly events: SecurityEventService,
  ) {}

  /**
   * Save the role and end the sessions of every holder in one transaction.
   * The role is re-read inside the work function and the previous slug and
   * rename flag are recomputed from it, so a rename that landed before this
   * transaction cannot make the holder match miss.
   */
  async commit(
    roleId: Types.ObjectId,
    dto: UpdateRoleDto,
    actorId: string,
  ): Promise<RoleEditOutcome> {
    const requestedSlug = dto.name ? generateSlug(dto.name) : undefined;
    try {
      const outcome = await withMajorityTransaction(
        this.connection,
        async (session) => {
          await assertFreshRolePermission(
            this.userModel,
            this.roleModel,
            actorId,
            ROLE_PERMISSIONS.UPDATE_ALL,
            session,
          );
          const current = await this.roleModel
            .findById(roleId)
            .session(session)
            .exec();
          if (!current) {
            throw new AppException(
              ErrorCode.ROLE_NOT_FOUND,
              'Role no longer exists',
              HttpStatus.NOT_FOUND,
            );
          }
          const previousSlug = current.slug;
          const nextSlug = dto.name ? generateSlug(dto.name) : previousSlug;
          const renamed = nextSlug !== previousSlug;
          const permissionsChanged =
            dto.permissions !== undefined &&
            !samePermissions(current.permissions, dto.permissions);

          if (dto.name && dto.name !== current.name) {
            current.name = dto.name;
            current.slug = nextSlug;
          }
          if (dto.description !== undefined) {
            current.description = dto.description;
          }
          if (dto.permissions) {
            current.permissions = dedupePermissions(dto.permissions);
          }
          if (renamed) {
            if (
              (current.pendingHolderSweeps ?? []).length >=
              ROLE_PENDING_SWEEP_LIMIT
            ) {
              throw new AppException(
                ErrorCode.AUTHORITY_UNAVAILABLE,
                'Pending role repairs must finish before another rename',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }
            current.pendingHolderSweeps = [
              ...(current.pendingHolderSweeps ?? []),
              {
                roleId: current._id,
                previousSlug,
                actorId,
                sweepId: randomUUID(),
              },
            ];
          }
          await current.save({ session });

          if (!renamed && !permissionsChanged) {
            return {
              role: current,
              usersMoved: 0,
              previousSlug,
              nextSlug,
              renamed,
            };
          }

          const usersMoved = await moveRoleHolders({
            userModel: this.userModel,
            events: this.events,
            previousSlugs: [previousSlug],
            nextSlug,
            actorId,
            session,
          });
          return {
            role: current,
            usersMoved: renamed ? usersMoved : 0,
            previousSlug,
            nextSlug,
            renamed,
          };
        },
      );
      outcome.usersMoved += await this.repair(
        roleId,
        outcome.role.pendingHolderSweeps ?? [],
      );
      return outcome;
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new AppException(
          ErrorCode.ROLE_NAME_TAKEN,
          `Role with slug "${requestedSlug ?? 'requested'}" already exists`,
          HttpStatus.CONFLICT,
        );
      }
      if (error instanceof MongooseError.ValidationError) {
        throw new AppException(
          ErrorCode.VALIDATION_ERROR,
          error.message,
          HttpStatus.BAD_REQUEST,
        );
      }
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }
      asAuthorityUnavailable(error);
    }
  }

  async delete(roleId: Types.ObjectId, actorId: string): Promise<void> {
    try {
      const repairOwnerId = await withMajorityTransaction(
        this.connection,
        async (session) => {
          await assertFreshRolePermission(
            this.userModel,
            this.roleModel,
            actorId,
            ROLE_PERMISSIONS.DELETE_ALL,
            session,
          );
          const current = await this.roleModel
            .findById(roleId)
            .session(session)
            .exec();
          if (!current) {
            throw new AppException(
              ErrorCode.ROLE_NOT_FOUND,
              'Role no longer exists',
              HttpStatus.NOT_FOUND,
            );
          }
          if (current.isSystemRole || current.isProtected) {
            throw new AppException(
              ErrorCode.ROLE_PROTECTED,
              'Role is protected',
              HttpStatus.FORBIDDEN,
            );
          }
          const count = await this.userModel
            .countDocuments({ role: current.slug })
            .session(session)
            .exec();
          if (count > 0) {
            throw new AppException(
              ErrorCode.ROLE_HAS_USERS,
              'Reassign role holders before deleting',
              HttpStatus.BAD_REQUEST,
              { count },
            );
          }
          const fallback = await this.roleModel
            .findOne({ slug: UserRole.USER })
            .session(session)
            .exec();
          if (!fallback) {
            throw new AppException(
              ErrorCode.ROLE_NOT_FOUND,
              'Default role does not exist',
              HttpStatus.NOT_FOUND,
            );
          }
          const ref = {
            roleId: current._id,
            previousSlug: current.slug,
            actorId,
            sweepId: randomUUID(),
          };
          const transferred = current.pendingHolderSweeps ?? [];
          const recorded = transferred.length > 0;
          if (recorded) {
            const refs = [
              ...(fallback.pendingHolderSweeps ?? []),
              ref,
              ...transferred,
            ];
            if (refs.length > ROLE_PENDING_SWEEP_LIMIT) {
              throw new AppException(
                ErrorCode.AUTHORITY_UNAVAILABLE,
                'Pending role repairs must finish before deleting',
                HttpStatus.SERVICE_UNAVAILABLE,
              );
            }
            fallback.pendingHolderSweeps = refs;
            await fallback.save({ session });
          }
          await this.events.recordRoleDeletion(
            {
              roleId: ref.roleId.toString(),
              previousSlug: ref.previousSlug,
              actorId,
              sweepId: ref.sweepId,
            },
            session,
          );
          await this.roleModel
            .deleteOne({ _id: current._id }, { session })
            .exec();
          return {
            ownerId: fallback._id,
            refs: [ref, ...transferred],
            recorded,
          };
        },
      );
      await this.repair(
        repairOwnerId.ownerId,
        repairOwnerId.refs,
        repairOwnerId.recorded,
      );
    } catch (error) {
      if (!isDatabaseUnavailableError(error)) {
        throw error;
      }
      asAuthorityUnavailable(error);
    }
  }

  private repair(
    ownerId: Types.ObjectId,
    refs: PendingRoleSweep[],
    recorded = true,
  ): Promise<number> {
    return repairPendingRoleSweeps({
      connection: this.connection,
      roleModel: this.roleModel,
      userModel: this.userModel,
      events: this.events,
      ownerId,
      refs,
      recorded,
      logger: this.logger,
    });
  }
}
