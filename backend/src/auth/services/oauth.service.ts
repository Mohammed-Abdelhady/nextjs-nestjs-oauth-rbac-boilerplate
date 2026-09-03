import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Response } from 'express';
import {
  IOAuthStrategy,
  OAuthUserProfile,
} from '../strategies/oauth.strategy.interface';
import { GoogleOAuthStrategy } from '../strategies/google-oauth.strategy';
import { GitHubOAuthStrategy } from '../strategies/github-oauth.strategy';
import { FacebookOAuthStrategy } from '../strategies/facebook-oauth.strategy';
import { User, UserDocument } from '../../user/schemas/user.schema';
import { AuthProvider } from '../../user/enums/auth-provider.enum';
import { ApiResponse } from '../../common/dto/api-response.dto';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { SessionService } from './session.service';
import { OAuthProvider, AUTH_PROVIDER_MAP } from '../constants/oauth.constants';
import {
  OAuthLoginResponseData,
  OAuthLoginResponseDto,
} from '../dto/oauth-login-response.dto';

export { OAuthProvider } from '../constants/oauth.constants';
export {
  OAuthLoginResponseData,
  OAuthLoginResponseDto,
} from '../dto/oauth-login-response.dto';

@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);
  private readonly strategies: Map<OAuthProvider, IOAuthStrategy> = new Map();

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly sessionService: SessionService,
    private readonly configService: ConfigService,
    private readonly googleStrategy: GoogleOAuthStrategy,
    private readonly githubStrategy: GitHubOAuthStrategy,
    private readonly facebookStrategy: FacebookOAuthStrategy,
  ) {
    this.registerStrategies();
    this.logEnabledProviders();
  }

  private registerStrategies(): void {
    const allStrategies: [OAuthProvider, IOAuthStrategy][] = [
      ['google', this.googleStrategy],
      ['github', this.githubStrategy],
      ['facebook', this.facebookStrategy],
    ];

    for (const [provider, strategy] of allStrategies) {
      if (strategy.isEnabled) {
        this.strategies.set(provider, strategy);
      }
    }
  }

  private logEnabledProviders(): void {
    const enabled = this.getSupportedProviders();
    if (enabled.length > 0) {
      this.logger.log(`OAuth providers enabled: ${enabled.join(', ')}`);
    } else {
      this.logger.log('No OAuth providers enabled');
    }
  }

  isProviderEnabled(provider: OAuthProvider): boolean {
    return this.strategies.has(provider);
  }

  private getStrategy(provider: OAuthProvider): IOAuthStrategy {
    const strategy = this.strategies.get(provider);

    if (!strategy) {
      const knownProviders: OAuthProvider[] = ['google', 'facebook', 'github'];
      if (knownProviders.includes(provider)) {
        const errorCodeMap: Record<OAuthProvider, ErrorCode> = {
          google: ErrorCode.GOOGLE_NOT_CONFIGURED,
          facebook: ErrorCode.FACEBOOK_NOT_CONFIGURED,
          github: ErrorCode.GITHUB_NOT_CONFIGURED,
        };
        throw new AppException(
          errorCodeMap[provider],
          `OAuth provider '${provider}' is not configured`,
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new AppException(
        ErrorCode.INVALID_OAUTH_PROVIDER,
        `OAuth provider '${provider}' is not supported`,
        HttpStatus.BAD_REQUEST,
      );
    }

    return strategy;
  }

  getAuthorizationUrl(provider: OAuthProvider): string {
    const strategy = this.getStrategy(provider);
    const state = this.generateState();
    return strategy.getAuthorizationUrl(state);
  }

  async handleCallback(
    provider: OAuthProvider,
    code: string,
    state: string,
    response: Response,
  ): Promise<ApiResponse<OAuthLoginResponseData>> {
    try {
      const strategy = this.getStrategy(provider);
      const oauthProfile = await strategy.getUserProfile(code, state);

      this.logger.log(
        `Received OAuth profile from ${provider}: ${oauthProfile.email}`,
      );

      const user = await this.findOrCreateUser(provider, oauthProfile);

      const userAgent = response.req.headers['user-agent'] || 'Unknown';
      const ip = response.req.ip || '127.0.0.1';
      const sessionToken = await this.sessionService.createSession(
        user._id,
        userAgent,
        ip,
      );

      const cookieName = this.configService.get<string>(
        'session.cookieName',
        'sid',
      );
      const cookieMaxAge = this.configService.get<number>(
        'session.cookieMaxAge',
        604800000,
      );

      response.cookie(cookieName, sessionToken, {
        httpOnly: true,
        secure: this.configService.get('NODE_ENV') === 'production',
        sameSite: 'strict',
        maxAge: cookieMaxAge,
        path: '/',
      });

      this.logger.log(`User authenticated via ${provider}: ${user.email}`);

      return OAuthLoginResponseDto.success({
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
        authProvider: user.authProvider,
        isVerified: user.isVerified,
        provider,
      });
    } catch (error) {
      this.logger.error(
        `OAuth callback failed for ${provider}: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }
  }

  private async findOrCreateUser(
    provider: OAuthProvider,
    oauthProfile: OAuthUserProfile,
  ): Promise<UserDocument> {
    const providerIdField = `${provider}Id` as keyof User;
    const existingUserByProvider = await this.userModel.findOne({
      [providerIdField]: oauthProfile.providerId,
    });

    if (existingUserByProvider) {
      if (existingUserByProvider.isDeleted) {
        this.logger.warn(
          `OAuth login rejected: account for provider ${provider} (${oauthProfile.email}) is deleted`,
        );
        throw new AppException(
          ErrorCode.OAUTH_AUTHENTICATION_FAILED,
          'OAuth authentication failed',
          HttpStatus.UNAUTHORIZED,
        );
      }

      let updated = false;
      if (
        existingUserByProvider.name !== oauthProfile.name ||
        existingUserByProvider.email !== oauthProfile.email
      ) {
        existingUserByProvider.name = oauthProfile.name;
        existingUserByProvider.email = oauthProfile.email;
        updated = true;
      }

      const mappedProvider = AUTH_PROVIDER_MAP[provider];
      if (existingUserByProvider.primaryProvider === mappedProvider) {
        existingUserByProvider.profileSyncedAt = new Date();
        existingUserByProvider.lastSyncedProvider = provider;
        updated = true;
      }

      if (updated) {
        await existingUserByProvider.save();
      }
      return existingUserByProvider;
    }

    const existingUserByEmail = await this.userModel.findOne({
      email: oauthProfile.email,
    });

    const mappedProvider = AUTH_PROVIDER_MAP[provider];

    if (existingUserByEmail) {
      if (existingUserByEmail.isDeleted) {
        this.logger.warn(
          `OAuth login rejected: account with email ${oauthProfile.email} is deleted`,
        );
        throw new AppException(
          ErrorCode.OAUTH_AUTHENTICATION_FAILED,
          'OAuth authentication failed',
          HttpStatus.UNAUTHORIZED,
        );
      }

      (existingUserByEmail[providerIdField] as string) =
        oauthProfile.providerId;
      existingUserByEmail.isVerified = true;

      if (!existingUserByEmail.linkedProviders.includes(mappedProvider)) {
        existingUserByEmail.linkedProviders.push(mappedProvider);
      }

      if (
        !existingUserByEmail.primaryProvider &&
        mappedProvider !== AuthProvider.EMAIL
      ) {
        existingUserByEmail.primaryProvider = mappedProvider;
      }

      await existingUserByEmail.save();
      this.logger.log(
        `Auto-linked ${provider} account to existing user: ${oauthProfile.email}`,
      );
      return existingUserByEmail;
    }

    const newUser = await this.userModel.create({
      email: oauthProfile.email,
      name: oauthProfile.name,
      [providerIdField]: oauthProfile.providerId,
      isVerified: oauthProfile.emailVerified ?? true,
      authProvider: mappedProvider,
      linkedProviders: [mappedProvider],
      primaryProvider: mappedProvider,
      role: 'user',
    });

    this.logger.log(`Created new user via ${provider}: ${oauthProfile.email}`);
    return newUser;
  }

  private generateState(): string {
    return (
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  }

  async getUserProfile(
    provider: OAuthProvider,
    code: string,
    state?: string,
  ): Promise<OAuthUserProfile> {
    const strategy = this.getStrategy(provider);
    return strategy.getUserProfile(code, state);
  }

  getSupportedProviders(): OAuthProvider[] {
    return Array.from(this.strategies.keys());
  }
}
