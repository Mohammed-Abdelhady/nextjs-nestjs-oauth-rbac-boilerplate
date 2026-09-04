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
import { AuthMailService } from './services/auth-mail.service';
import { SessionCookieService } from './services/session-cookie.service';
import { SessionService } from './services/session.service';
import { VerificationCodeService } from './services/verification-code.service';
import { PasswordResetCodeService } from './services/password-reset-code.service';
import { toAuthenticatedUser } from './utils/authenticated-user.util';
import { resolveActivatedUser } from './utils/activation.util';
import { generateVerificationCode } from './utils/verification-code.util';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Role.name) private readonly roleModel: Model<RoleDocument>,
    private readonly hashService: HashService,
    private readonly authMailService: AuthMailService,
    private readonly sessionService: SessionService,
    private readonly verificationCodeService: VerificationCodeService,
    private readonly passwordResetCodeService: PasswordResetCodeService,
    private readonly sessionCookieService: SessionCookieService,
  ) {}

  /**
   * Start a registration. An address that already has a verified account gets
   * a notice instead of a code, and every caller gets the same reply.
   */
  async register(dto: RegisterDto): Promise<ApiResponse<RegisterResponseDto>> {
    const hashedPassword = await this.hashService.hash(dto.password);
    const existingUser = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });

    if (existingUser?.isVerified) {
      await this.spendCodeHashingTime();
      await this.authMailService.sendRegistrationAttemptNotice(
        dto.email,
        existingUser.name,
      );

      return RegisterResponseDto.success(dto.email);
    }

    const pending =
      await this.verificationCodeService.createOrUpdatePendingRegistration(
        dto.email,
        dto.name,
        hashedPassword,
      );

    await this.authMailService.sendActivationCode(
      dto.email,
      pending.code,
      pending.name,
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

    const user = await resolveActivatedUser(pending, this.userModel);
    this.logger.log(`Account activated: ${user.email}`);

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

  /**
   * Mail a fresh activation code for a pending registration. Accounts waiting
   * on a verification code, including one moved to a new address by an admin,
   * get their code here. Verified accounts and unknown addresses get the same
   * reply and no mail.
   */
  async resendActivation(
    dto: ResendActivationDto,
  ): Promise<ApiResponse<ResendActivationResponseDto>> {
    const existingUser = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });

    if (existingUser?.isVerified) {
      await this.spendCodeHashingTime();
      return ResendActivationResponseDto.success(dto.email);
    }

    const pending = await this.verificationCodeService.resendActivationCode(
      dto.email,
    );

    if (!pending) {
      await this.spendCodeHashingTime();
      return ResendActivationResponseDto.success(dto.email);
    }

    await this.authMailService.sendActivationCode(
      dto.email,
      pending.code,
      pending.name,
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

    return LoginResponseDto.success(
      await toAuthenticatedUser(user, this.roleModel),
    );
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

  /**
   * Mail a password reset code. An address without an account gets the same
   * reply as one with an account, and no mail.
   */
  async forgotPassword(
    dto: ForgotPasswordDto,
  ): Promise<ApiResponse<ForgotPasswordResponseDto>> {
    const user = await this.userModel.findOne({
      email: dto.email,
      isDeleted: { $ne: true },
    });

    if (!user) {
      await this.spendCodeHashingTime();
      return ForgotPasswordResponseDto.success(dto.email);
    }

    const code =
      await this.passwordResetCodeService.createOrUpdatePasswordReset(
        dto.email,
      );

    await this.authMailService.sendPasswordResetCode(
      dto.email,
      code,
      user.name,
    );

    return ForgotPasswordResponseDto.success(dto.email);
  }

  async resetPassword(
    dto: ResetPasswordDto,
  ): Promise<ApiResponse<ResetPasswordResponseDto>> {
    await this.passwordResetCodeService.verifyPasswordReset(
      dto.email,
      dto.code,
    );

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

    await this.passwordResetCodeService.clearPasswordReset(dto.email);
    return ResetPasswordResponseDto.success();
  }

  /**
   * Spend the bcrypt time a real code would have cost.
   * Requests for addresses without an account take as long as requests for
   * addresses with one.
   */
  private async spendCodeHashingTime(): Promise<void> {
    await this.hashService.hash(generateVerificationCode());
  }
}
