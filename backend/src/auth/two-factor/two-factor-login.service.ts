import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request, Response } from 'express';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { LoginResponseDto } from '../dto/login-response.dto';
import { SignInService } from '../services/sign-in.service';
import { VerifyTwoFactorDto } from './dto/verify-two-factor.dto';
import { TwoFactorChallengeService } from './services/two-factor-challenge.service';
import { TwoFactorVerificationService } from './services/two-factor-verification.service';

/**
 * The second half of a sign-in that was held for a code. The first half left a
 * challenge cookie; this turns a correct code into the session it was owed.
 */
@Injectable()
export class TwoFactorLoginService {
  private readonly logger = new Logger(TwoFactorLoginService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly challengeService: TwoFactorChallengeService,
    private readonly verificationService: TwoFactorVerificationService,
    private readonly signInService: SignInService,
  ) {}

  /**
   * @throws AppException TWO_FACTOR_CHALLENGE_INVALID when there is no usable
   * challenge behind the cookie
   * @throws AppException TWO_FACTOR_CODE_INVALID when the code is wrong, after
   * counting the try against the challenge
   */
  async verify(
    dto: VerifyTwoFactorDto,
    request: Request,
    response: Response,
  ): Promise<ApiResponse<LoginResponseDto>> {
    const challenge = await this.challengeService.read(request);
    const user = await this.userModel.findById(challenge.userId);

    if (!user || user.isDeleted || !user.twoFactor?.enabled) {
      await this.discard(challenge.challengeId, response);
      throw new AppException(
        ErrorCode.TWO_FACTOR_CHALLENGE_INVALID,
        'This sign-in attempt is no longer valid. Start again.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    try {
      await this.verificationService.verifySecondFactor(user, dto);
    } catch (error) {
      await this.challengeService.registerFailure(challenge.challengeId);
      throw error;
    }

    await this.discard(challenge.challengeId, response);
    const summary = await this.signInService.issueSession(user, response);

    this.logger.log(`Second factor accepted for ${user.email}`);
    return LoginResponseDto.success(summary);
  }

  private async discard(
    challengeId: Types.ObjectId,
    response: Response,
  ): Promise<void> {
    await this.challengeService.consume(challengeId);
    this.challengeService.clear(response);
  }
}
