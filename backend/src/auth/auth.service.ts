import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import { User, UserDocument } from '../user/schemas/user.schema';
import { Role, RoleDocument } from '../role/schemas/role.schema';
import { RegisterDto } from './dto/register.dto';
import { ActivateDto } from './dto/activate.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { RegisterResponseDto } from './dto/register-response.dto';
import { ActivateResponseDto } from './dto/activate-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { ForgotPasswordResponseDto } from './dto/forgot-password-response.dto';
import { ResetPasswordResponseDto } from './dto/reset-password-response.dto';
import { ResendActivationDto } from './dto/resend-activation.dto';
import { ResendActivationResponseDto } from './dto/resend-activation-response.dto';
import { ApiResponse } from '../common/dto/api-response.dto';
import { HashService } from '../common/services/hash.service';
import { AppException } from '../common/exceptions/app.exception';
import { ErrorCode } from '../common/enums/error-code.enum';
import { MailService } from '../mail/mail.service';
import { SessionCookieService } from './services/session-cookie.service';
import { SessionService } from './services/session.service';
import { VerificationCodeService } from './services/verification-code.service';
import { getEffectivePermissions } from './utils/permissions.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly hashService: HashService,
    private readonly mailService: MailService,
    private readonly sessionService: SessionService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  async register(dto: RegisterDto): Promise<ApiResponse<RegisterResponseDto>> {
    const existingUser = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });
    if (existingUser) {
      throw new AppException(
        ErrorCode.EMAIL_ALREADY_EXISTS,
        'Email already registered',
        HttpStatus.CONFLICT,
      );
    }

    const hashedPassword = await this.hashService.hash(dto.password);
    const code =
      await this.verificationCodeService.createOrUpdatePendingRegistration(
        dto.email,
        dto.name,
        hashedPassword,
      );

    await this.sendMailSafely(
      () => this.mailService.sendActivationCode(dto.email, code, dto.name),
      'Failed to send activation email',
    );

    return RegisterResponseDto.success(dto.email);
  }

  async activate(
    dto: ActivateDto,
    response: Response,
  ): Promise<ApiResponse<ActivateResponseDto>> {
    const pending =
      await this.verificationCodeService.verifyAndConsumeRegistration(
        dto.email,
        dto.code,
      );

    const user = await this.userModel.create({
      email: pending.email,
      password: pending.hashedPassword,
      name: pending.name,
      isVerified: true,
    });

    this.logger.log(`User created: ${user.email}`);

    const userAgent = response.req.headers['user-agent'] || 'Unknown';
    const ip = response.req.ip || '127.0.0.1';
    const sessionToken = await this.sessionService.createSession(
      user._id,
      userAgent,
      ip,
    );

    this.sessionCookieService.set(response, sessionToken);
    return ActivateResponseDto.success(user);
  }

  async resendActivation(
    dto: ResendActivationDto,
  ): Promise<ApiResponse<ResendActivationResponseDto>> {
    const existingUser = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });
    if (existingUser) {
      throw new AppException(
        ErrorCode.NO_PENDING_REGISTRATION_FOR_RESEND,
        'No pending registration found. Please register again.',
        HttpStatus.NOT_FOUND,
      );
    }

    const { code, name } =
      await this.verificationCodeService.resendActivationCode(dto.email);

    await this.sendMailSafely(
      () => this.mailService.sendActivationCode(dto.email, code, name),
      'Failed to send activation email',
    );

    return ResendActivationResponseDto.success(dto.email);
  }

  async login(
    dto: LoginDto,
    response: Response,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const user = await this.userModel
      .findOne({ email: dto.email, isDeleted: { $ne: true } })
      .select('+password');

    if (!user || !user.password) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const isPasswordValid = await this.hashService.compare(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new AppException(
        ErrorCode.INVALID_CREDENTIALS,
        'Invalid email or password',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const userAgent = response.req.headers['user-agent'] || 'Unknown';
    const ip = response.req.ip || '127.0.0.1';
    const sessionToken = await this.sessionService.createSession(
      user._id,
      userAgent,
      ip,
    );

    this.logger.log(`User logged in: ${user.email}`);
    this.sessionCookieService.set(response, sessionToken);

    const permissions = await getEffectivePermissions(user, this.roleModel);

    return LoginResponseDto.success({
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      authProvider: user.authProvider,
      isVerified: user.isVerified,
      permissions,
    });
  }

  async logout(
    sessionToken: string,
  ): Promise<ApiResponse<{ message: string }>> {
    const invalidated =
      await this.sessionService.invalidateSession(sessionToken);

    if (!invalidated) {
      throw new AppException(
        ErrorCode.SESSION_INVALID,
        'Invalid session',
        HttpStatus.UNAUTHORIZED,
      );
    }

    this.logger.log('User logged out successfully');
    return ApiResponse.success({ message: 'Logout successful' });
  }

  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ApiResponse<ForgotPasswordResponseDto>> {
    const user = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });
    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND_FOR_RESET,
        'No account found with this email address',
        HttpStatus.NOT_FOUND,
      );
    }

    const code = await this.verificationCodeService.createOrUpdatePasswordReset(
      dto.email,
    );

    await this.sendMailSafely(
      () => this.mailService.sendPasswordResetCode(dto.email, code, user.name),
      'Failed to send password reset email',
    );

    return ForgotPasswordResponseDto.success(dto.email);
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<ApiResponse<ResetPasswordResponseDto>> {
    await this.verificationCodeService.verifyPasswordReset(dto.email, dto.code);

    const user = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });
    if (!user) {
      throw new AppException(
        ErrorCode.USER_NOT_FOUND_FOR_RESET,
        'User not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const hashedPassword = await this.hashService.hash(dto.newPassword);
    user.password = hashedPassword;
    await user.save();

    await this.sessionService.invalidateAllSessions(user._id);
    this.logger.log(`Password reset successful for: ${user.email}`);

    await this.verificationCodeService.clearPasswordReset(dto.email);
    return ResetPasswordResponseDto.success();
  }

  private async sendMailSafely(
    action: () => Promise<void>,
    failureMessage: string,
  ): Promise<void> {
    try {
      await action();
    } catch (error) {
      this.logger.error(
        `${failureMessage}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw new AppException(
        ErrorCode.EMAIL_SEND_FAILED,
        failureMessage,
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
