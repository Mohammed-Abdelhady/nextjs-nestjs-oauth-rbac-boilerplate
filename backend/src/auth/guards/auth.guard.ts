import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpStatus,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Model } from 'mongoose';
import { Request, Response } from 'express';
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
import {
  NativeAccessService,
  readBearerToken,
} from '../../session/native/native-access.service';

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
 * through without a session. Cookie sessions win. A bearer token is accepted
 * only when no session cookie is present, and only if it is a native access token.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly sessionService: SessionService,
    private readonly sessionCookieService: SessionCookieService,
    private readonly nativeAccess: NativeAccessService,
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
    const response = context.switchToHttp().getResponse<Response>();
    const sessionToken = this.sessionCookieService.read(request);
    const bearer = readBearerToken(request);
    let session: LeanSession | null;

    if (sessionToken) {
      session = await this.sessionService.validateSession(sessionToken);
    } else if (bearer) {
      session = await this.nativeAccess.validate(bearer);
    } else {
      throw new AppException(
        ErrorCode.SESSION_REQUIRED,
        'Authentication required',
        HttpStatus.UNAUTHORIZED,
      );
    }

    if (!session) {
      this.sessionCookieService.clear(response);
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Invalid or expired session',
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Attach user and session to request for use in controllers
    const user = session.user as unknown as UserDocument | null;

    if (!user || user.isDeleted) {
      this.sessionCookieService.clear(response);
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
