import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import {
  PendingRegistration,
  PendingRegistrationSchema,
} from './schemas/pending-registration.schema';
import {
  PendingPasswordReset,
  PendingPasswordResetSchema,
} from './schemas/pending-password-reset.schema';
import { User, UserSchema } from '../user/schemas/user.schema';
import { Session, SessionSchema } from '../session/schemas/session.schema';
import { Role, RoleSchema } from '../role/schemas/role.schema';
import { SessionService } from './services/session.service';
import { SessionCookieService } from './services/session-cookie.service';
import { VerificationCodeService } from './services/verification-code.service';
import { PasswordResetCodeService } from './services/password-reset-code.service';
import { AuthMailService } from './services/auth-mail.service';
import { CommonModule } from '../common/common.module';
import { MailModule } from '../mail/mail.module';
import { UserModule } from '../user/user.module';
import { SessionModule } from '../session/session.module';
import { AuthGuard } from './guards/auth.guard';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: PendingRegistration.name, schema: PendingRegistrationSchema },
      { name: PendingPasswordReset.name, schema: PendingPasswordResetSchema },
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
    SessionService,
    SessionCookieService,
    VerificationCodeService,
    PasswordResetCodeService,
    AuthMailService,
    AuthGuard,
    // Registered here, not in AppModule: AuthGuard injects the Role model,
    // which only resolves inside this module's context.
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
  ],
  exports: [
    AuthService,
    SessionService,
    SessionCookieService,
    VerificationCodeService,
    AuthGuard,
  ],
})
export class AuthModule {}

/**
 * Decorators are exported directly from their source files:
 * - @Public() from './decorators/public.decorator'
 * - @CurrentUser() from './decorators/current-user.decorator'
 */
