import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { AdminUserDto, UserListData } from '../dto/admin-user-response.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { ADMIN_USER_HIDDEN_FIELDS } from '../constants/admin-user.constants';
import { mapToAdminUserDto } from '../mappers/admin-user.mapper';
import { buildUserFilter, buildUserSort } from '../utils/user-filter.util';
import { AdminUserAccessService } from './admin-user-access.service';

/**
 * Read paths of the admin user area.
 * Reads use the non-strict hierarchy comparison, so an actor also sees peers.
 */
@Injectable()
export class AdminUserQueriesService {
  private readonly logger = new Logger(AdminUserQueriesService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly accessService: AdminUserAccessService,
  ) {}

  /**
   * List every user whose role sits at or below the actor's level,
   * custom roles included.
   */
  async listUsers(
    query: ListUsersQueryDto,
    actorRole: string,
  ): Promise<ApiResponse<UserListData>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = query;
    const viewableRoles = await this.accessService.getViewableSlugs(actorRole);
    const filter = buildUserFilter(query, viewableRoles);

    const [users, total] = await Promise.all([
      this.userModel
        .find(filter)
        .select(ADMIN_USER_HIDDEN_FIELDS)
        .sort(buildUserSort(sortBy, sortOrder))
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter),
    ]);

    this.logger.log(`Listed ${users.length} users (page ${page}, ${total})`);

    return ApiResponse.success({
      data: users.map((user) => mapToAdminUserDto(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  /**
   * Read a single user the actor is allowed to see.
   */
  async getUserById(
    id: string,
    actorRole: string,
  ): Promise<ApiResponse<AdminUserDto>> {
    const user = await this.userModel
      .findById(id)
      .select(ADMIN_USER_HIDDEN_FIELDS)
      .exec();

    if (!user || user.isDeleted) {
      this.logger.warn(`User not found or deleted: ${id}`);
      throw new AppException(
        ErrorCode.USER_NOT_FOUND,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    await this.accessService.assertCanView(actorRole, user.role);

    return ApiResponse.success(mapToAdminUserDto(user));
  }
}
