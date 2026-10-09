import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegistrationService } from './services/registration/registration.service';
import { AuthController } from './auth.controller';
import {
  PendingRegistration,
  PendingRegistrationSchema,
} from './schemas/pending-registration.schema';
import {
  PendingPasswordReset,
  PendingPasswordResetSchema,
} from './schemas/pending-password-reset.schema';
import { MailCounter, MailCounterSchema } from './schemas/mail-counter.schema';
// feature:totp:start
import {
  TwoFactorChallenge,
  TwoFactorChallengeSchema,
} from './two-factor/schemas/two-factor-challenge.schema';
// feature:totp:end
import { User, UserSchema } from '../user/schemas/user.schema';
import { Session, SessionSchema } from '../session/schemas/session.schema';
import { Role, RoleSchema } from '../role/schemas/role.schema';
import { SessionService } from './services/sessions/session.service';
import { SessionCookieService } from './services/sessions/session-cookie.service';
import { SignInService } from './services/sessions/sign-in.service';
import { TotpSecretCryptoService } from './two-factor/services/totp-secret-crypto.service'; // feature:totp
import { TwoFactorChallengeService } from './two-factor/services/two-factor-challenge.service'; // feature:totp
import { TwoFactorVerificationService } from './two-factor/services/two-factor-verification.service'; // feature:totp
import { MONGO_SECOND_FACTOR_STORES } from './two-factor/persistence/mongo/mongo-second-factor-stores'; // feature:totp
import { SecondFactorStore } from './two-factor/stores/second-factor.store'; // feature:totp
import { VerificationCodeService } from './services/codes/verification-code.service';
import { MailCounterService } from './services/mail/mail-counter.service';
import { EmailChangeConfirmationService } from './services/registration/email-change-confirmation.service';
import { PasswordResetCodeService } from './services/codes/password-reset-code.service';
import { AuthMailService } from './services/mail/auth-mail.service';
import { AuthFeaturesService } from './services/features/auth-features.service';
import { FeatureEnabledGuard } from './guards/feature-enabled.guard';
import { CommonModule } from '../common/common.module';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../user/user.module';
import { SessionModule } from '../session/session.module';
import { BrowserProofGuard } from './guards/browser-proof.guard';
import { MONGO_PENDING_CODE_STORES } from './persistence/mongo/mongo-pending-code-stores';
import { MONGO_ACTIVATION_STORES } from './persistence/mongo/mongo-activation-accounts';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PendingRegistration.name, schema: PendingRegistrationSchema },
      { name: PendingPasswordReset.name, schema: PendingPasswordResetSchema },
      { name: MailCounter.name, schema: MailCounterSchema },
      { name: TwoFactorChallenge.name, schema: TwoFactorChallengeSchema }, // feature:totp
      { name: User.name, schema: UserSchema },
      { name: Session.name, schema: SessionSchema },
      { name: Role.name, schema: RoleSchema },
    ]),
    CommonModule,
    MailModule,
    forwardRef(() => UserModule),
    SessionModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    RegistrationService,
    SessionService,
    SessionCookieService,
    VerificationCodeService,
    MailCounterService,
    EmailChangeConfirmationService,
    PasswordResetCodeService,
    AuthMailService,
    AuthFeaturesService,
    ...MONGO_PENDING_CODE_STORES,
    ...MONGO_ACTIVATION_STORES,
    // feature:totp:start
    // The second factor hooks into every sign-in path, so the pieces those
    // paths need are declared here rather than in TwoFactorModule.
    TotpSecretCryptoService,
    TwoFactorChallengeService,
    TwoFactorVerificationService,
    ...MONGO_SECOND_FACTOR_STORES,
    // feature:totp:end
    SignInService,
    FeatureEnabledGuard,
    AuthGuard,
    // Registered here, not in AppModule: AuthGuard injects the Role model,
    // which only resolves inside this module's context.
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: BrowserProofGuard,
    },
  ],
  exports: [
    AuthService,
    SessionService,
    SessionCookieService,
    VerificationCodeService,
    AuthMailService,
    AuthFeaturesService,
    // feature:totp:start
    TotpSecretCryptoService,
    TwoFactorChallengeService,
    TwoFactorVerificationService,
    SecondFactorStore,
    // feature:totp:end
    SignInService,
    FeatureEnabledGuard,
    AuthGuard,
  ],
})
export class AuthModule {}

/**
 * Decorators are exported directly from their source files:
 * - @Public() from './decorators/public.decorator'
 * - @CurrentUser() from './decorators/current-user.decorator'
 */
