import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import {
  isUnknownTransactionOutcome,
  withMajorityTransaction,
} from '../../../session/utils/transactions/mongo-transaction';
import { rethrowOrUnavailable } from '../../utils/admin-transaction.util';
import { isMongoDuplicateKeyError } from '../../../common/utils/mongo-error.util';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from '../../../user/schemas/user.schema';
import { Role, RoleDocument } from '../../../role/schemas/role.schema';
import { AuthProvider } from '../../../user/enums/auth-provider.enum';
import { SecurityEventService } from '../../../session/services/security-event.service';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { ApiResponse } from '../../../common/dto/api-response.dto';
import { CreateUserDto } from '../../dto/create-user.dto';
import { AdminUserDto } from '../../dto/admin-user-response.dto';
import { ADMIN_PASSWORD_SALT_ROUNDS } from '../../constants/admin-user.constants';
import { mapToAdminUserDto } from '../../mappers/admin-user.mapper';
import { AdminUserAccessService } from './admin-user-access.service';
import { reconcileAssignedRole } from '../../utils/admin-role-reconcile.util';
import type { AssignedRoleRef } from '../../types/assigned-role-ref';

/**
 * Creating an account from the admin area. The role must exist and sit below
 * the actor's level, and the created slug is repaired if a rename lands while
 * the account is written.
 */
@Injectable()
export class AdminUserCreateService {
  private readonly logger = new Logger(AdminUserCreateService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly events: SecurityEventService,
    private readonly accessService: AdminUserAccessService,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /**
   * Create a user. The role must exist and sit below the actor's level.
   */
  async createUser(
    dto: CreateUserDto,
    actorRole: string,
    actorId: string,
  ): Promise<ApiResponse<AdminUserDto>> {
    const { email, name, password, role } = dto;

    const existingUser = await this.userModel
      .findOne({ email: { $eq: email } })
      .exec();
    if (existingUser) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already in use',
        HttpStatus.CONFLICT,
      );
    }

    await this.accessService.assertCanAssignRole(actorRole, role);

    const hashedPassword = await bcrypt.hash(
      password,
      ADMIN_PASSWORD_SALT_ROUNDS,
    );
    let createdUserId: Types.ObjectId | undefined;
    let assignmentRef: AssignedRoleRef | undefined;
    let transactionAcknowledged = false;
    try {
      const outcome = await withMajorityTransaction(
        this.connection,
        async (session) => {
          const assignedRole = await this.roleModel
            .findOne({ slug: role })
            .session(session)
            .exec();
          if (!assignedRole) {
            throw new AppException(
              ErrorCode.ROLE_NOT_FOUND,
              `Role "${role}" does not exist`,
              HttpStatus.NOT_FOUND,
            );
          }
          await this.accessService.assertFreshActorCanModify(
            actorId,
            assignedRole.slug,
            session,
          );
          const newUser = new this.userModel({
            email,
            name,
            password: hashedPassword,
            role: assignedRole.slug,
            isVerified: true,
            permissions: [],
            authProvider: AuthProvider.EMAIL,
            primaryProvider: AuthProvider.EMAIL,
          });
          await newUser.save({ session });
          createdUserId = newUser._id;
          assignmentRef = {
            roleId: assignedRole._id,
            assignedSlug: assignedRole.slug,
            created: {
              updatedAt: newUser.updatedAt,
              sessionVersion: newUser.sessionVersion ?? 0,
            },
          };
          return { newUser, roleId: assignedRole._id };
        },
      );
      transactionAcknowledged = true;
      const { newUser } = outcome;
      newUser.role = await reconcileAssignedRole({
        connection: this.connection,
        roleModel: this.roleModel,
        userModel: this.userModel,
        events: this.events,
        logger: this.logger,
        actorId,
        userId: newUser._id,
        ref: {
          roleId: outcome.roleId,
          assignedSlug: role,
          created: {
            updatedAt: newUser.updatedAt,
            sessionVersion: newUser.sessionVersion,
          },
        },
      });
      this.logger.log(
        `User created by admin: userId=${newUser._id.toString()} as ${newUser.role}`,
      );
      return ApiResponse.success(
        mapToAdminUserDto(newUser),
        'User created successfully',
      );
    } catch (error) {
      if (isMongoDuplicateKeyError(error)) {
        throw new AppException(
          ErrorCode.EMAIL_ALREADY_EXISTS,
          'Email already in use',
          HttpStatus.CONFLICT,
        );
      }
      if (
        !transactionAcknowledged &&
        isUnknownTransactionOutcome(error) &&
        createdUserId &&
        assignmentRef
      ) {
        try {
          await reconcileAssignedRole({
            connection: this.connection,
            roleModel: this.roleModel,
            userModel: this.userModel,
            events: this.events,
            logger: this.logger,
            actorId,
            userId: createdUserId,
            ref: assignmentRef,
          });
        } catch {
          // A role rename or deletion also records its own durable sweep.
        }
      }
      rethrowOrUnavailable(error);
    }
  }
}
