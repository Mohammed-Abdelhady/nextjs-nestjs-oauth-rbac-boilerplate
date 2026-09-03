import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { SessionService } from '../services/session.service';
import { SessionDocument } from '../../session/schemas/session.schema';
import { UserDocument } from '../../user/schemas/user.schema';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    isVerified: boolean;
  };
  session?: SessionDocument;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const cookieName = process.env.SESSION_COOKIE_NAME || 'sid';
    const sessionToken = request.cookies?.[cookieName] as string | undefined;

    if (!sessionToken) {
      throw new AppException(
        ErrorCode.SESSION_REQUIRED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const session = await this.sessionService.validateSession(sessionToken);

    if (!session) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Invalid or expired session',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Attach user and session to request for use in controllers
    const user = session.user as unknown as UserDocument | null;

    if (!user || user.isDeleted) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Invalid or expired session',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Compute effective permissions (role + direct)
    const effectivePermissions = await this.getEffectivePermissions(user);

    request.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: effectivePermissions,
      isVerified: user.isVerified,
    };
    request.session = session;

    return true;
  }

  /**
   * Get effective permissions for a user (role permissions + direct permissions).
   * @param user - User document
   * @returns Array of effective permissions (deduplicated)
   */
  private async getEffectivePermissions(user: UserDocument): Promise<string[]> {
    const rolePermissions: string[] = [];

    // Fetch role permissions
    if (user.role) {
      const role = await this.roleModel.findOne({ slug: user.role }).exec();
      if (role && role.permissions) {
        rolePermissions.push(...role.permissions);
      }
    }

    // Combine role permissions with direct user permissions
    const directPermissions = user.permissions || [];
    const allPermissions = [...rolePermissions, ...directPermissions];

    // Deduplicate permissions
    return [...new Set(allPermissions)];
  }
}
