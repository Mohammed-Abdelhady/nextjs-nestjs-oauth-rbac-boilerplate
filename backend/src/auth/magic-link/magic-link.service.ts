import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request, Response } from 'express';
import {
  PendingMagicLink,
  PendingMagicLinkDocument,
} from './schemas/pending-magic-link.schema';
import { RequestMagicLinkDto } from './dto/request-magic-link.dto';
import { VerifyMagicLinkDto } from './dto/verify-magic-link.dto';
import { MagicLinkRequestResponseDto } from './dto/magic-link-request-response.dto';
import {
  MAGIC_LINK_CLIENT_PATH,
  MAGIC_LINK_RATE_WINDOW_MS,
} from './constants/magic-link.constants';
import {
  createMagicLinkToken,
  deriveNameFromEmail,
  hashMagicLinkToken,
} from './utils/magic-link-token.util';
import { LoginResponseDto } from '../dto/login-response.dto';
import { AuthMailService } from '../services/auth-mail.service';
import { SessionService } from '../services/session.service';
import { SessionCookieService } from '../services/session-cookie.service';
import { toAuthenticatedUser } from '../utils/authenticated-user.util';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { Role, RoleDocument } from '../../role/schemas/role.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';

const MILLISECONDS_PER_MINUTE = 60000;

/**
 * Passwordless sign-in. A request mails a one-time link; verifying it creates
 * the session, and creates the account when the address has none.
 */
@Injectable()
export class MagicLinkService {
  private readonly logger = new Logger(MagicLinkService.name);
  private readonly expiresIn: number;
  private readonly maxPerHour: number;

  constructor(
    @InjectModel(PendingMagicLink.name)
    private readonly pendingMagicLinkModel: Model<PendingMagicLinkDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly configService: ConfigService,
    private readonly authMailService: AuthMailService,
    private readonly sessionService: SessionService,
    private readonly sessionCookieService: SessionCookieService,
  ) {
    this.expiresIn = this.configService.get<number>(
      'magicLink.expiresIn',
      900000,
    );
    this.maxPerHour = this.configService.get<number>('magicLink.maxPerHour', 5);
  }

  /**
   * Mail a sign-in link. An address without an account gets one too, because
   * following it is how a passwordless account is created. A soft-deleted
   * account and an address over the hourly cap get the reply and no mail.
   */
  async request(
    dto: RequestMagicLinkDto,
    request: Request,
  ): Promise<ApiResponse<MagicLinkRequestResponseDto>> {
    const user = await this.userModel.findOne({ email: dto.email });

    if (user?.isDeleted) {
      this.spendTokenHashingTime();
      this.logger.warn('Magic link request for a deleted account');
      return MagicLinkRequestResponseDto.success(dto.email);
    }

    const recentLinks = await this.pendingMagicLinkModel.countDocuments({
      email: dto.email,
      createdAt: { $gte: new Date(Date.now() - MAGIC_LINK_RATE_WINDOW_MS) },
    });

    if (recentLinks >= this.maxPerHour) {
      this.spendTokenHashingTime();
      this.logger.warn(`Magic link hourly cap reached for ${dto.email}`);
      return MagicLinkRequestResponseDto.success(dto.email);
    }

    const token = createMagicLinkToken();
    await this.pendingMagicLinkModel.create({
      email: dto.email,
      tokenHash: hashMagicLinkToken(token),
      expiresAt: new Date(Date.now() + this.expiresIn),
      consumedAt: null,
      requestIp: request.ip,
      userAgent: request.headers['user-agent'],
    });

    await this.authMailService.sendMagicLink(
      dto.email,
      this.buildLink(token),
      Math.round(this.expiresIn / MILLISECONDS_PER_MINUTE),
    );

    this.logger.log(`Magic link sent to ${dto.email}`);
    return MagicLinkRequestResponseDto.success(dto.email);
  }

  /**
   * Spend a link and sign its owner in.
   *
   * @throws AppException MAGIC_LINK_INVALID when the token is unknown, already
   * spent, expired, or belongs to a deleted account
   */
  async verify(
    dto: VerifyMagicLinkDto,
    response: Response,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const link = await this.pendingMagicLinkModel.findOneAndUpdate(
      { tokenHash: hashMagicLinkToken(dto.token), consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { new: true },
    );

    if (!link) {
      throw this.invalidLink('token is unknown or already used');
    }

    if (link.expiresAt.getTime() <= Date.now()) {
      throw this.invalidLink('token has expired');
    }

    const user = await this.resolveUser(link.email);
    const userAgent = response.req.headers['user-agent'] || 'Unknown';
    const ip = response.req.ip || '127.0.0.1';
    const sessionToken = await this.sessionService.createSession(
      user._id,
      userAgent,
      ip,
    );

    this.sessionCookieService.set(response, sessionToken);
    this.logger.log(`User signed in with a magic link: ${user.email}`);

    return LoginResponseDto.success(
      await toAuthenticatedUser(user, this.roleModel),
    );
  }

  /**
   * The account behind a spent link. Following the link proves control of the
   * address, so it both creates the account and verifies an existing one.
   */
  private async resolveUser(email: string): Promise<UserDocument> {
    const existing = await this.userModel.findOne({ email });

    if (existing?.isDeleted) {
      throw this.invalidLink('account is deleted');
    }

    if (existing) {
      if (!existing.isVerified) {
        existing.isVerified = true;
        await existing.save();
      }
      return existing;
    }

    return this.createUser(email);
  }

  /**
   * Create the passwordless account. It carries no password hash, which is how
   * the rest of the application tells that password sign-in does not apply.
   */
  private async createUser(email: string): Promise<UserDocument> {
    try {
      const user = await this.userModel.create({
        email,
        name: deriveNameFromEmail(email),
        isVerified: true,
        authProvider: AuthProvider.EMAIL,
        primaryProvider: AuthProvider.EMAIL,
      });

      this.logger.log('Created a new account from a magic link');
      return user;
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) {
        throw error;
      }

      // Two links for the same new address were spent at once.
      const created = await this.userModel.findOne({ email });
      if (!created) {
        throw error;
      }
      return created;
    }
  }

  private buildLink(token: string): string {
    const clientUrl = this.configService.get<string>(
      'cors.clientUrl',
      'http://localhost:3000',
    );
    const url = new URL(
      `${clientUrl.replace(/\/$/, '')}${MAGIC_LINK_CLIENT_PATH}`,
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  /**
   * Spend the work a real link would have cost, so a request that mails
   * nothing does not answer faster than one that does.
   */
  private spendTokenHashingTime(): void {
    hashMagicLinkToken(createMagicLinkToken());
  }

  private invalidLink(reason: string): AppException {
    this.logger.warn(`Magic link rejected: ${reason}`);
    return new AppException(
      ErrorCode.MAGIC_LINK_INVALID,
      'This sign-in link is no longer valid. Request a new one.',
      HttpStatus.BAD_REQUEST,
    );
  }
}
