import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Model } from 'mongoose';
import { Request } from 'express';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import {
  SessionDocument,
  LeanSession,
} from '../../session/schemas/session.schema';
import { UserDocument } from '../../user/schemas/user.schema';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { getEffectivePermissions } from '../utils/permissions.util';

export interface RequestWithUser extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    isVerified: boolean;
  };
  session?: LeanSession | SessionDocument;
}

/**
 * Runs on every route as a global guard. Routes marked with `@Public()` pass
 * through without a session; everything else needs a valid session cookie.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionCookieService: SessionCookieService,
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const sessionToken = this.sessionCookieService.read(request);

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
    const effectivePermissions = await getEffectivePermissions(
      user,
      this.roleModel,
    );

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
}
