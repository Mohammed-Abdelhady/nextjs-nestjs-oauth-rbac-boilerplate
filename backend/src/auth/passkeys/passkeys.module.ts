import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth.module';
import { PasskeysController } from './passkeys.controller';
import { PasskeyLoginController } from './passkey-login.controller';
import { PasskeyAssertionService } from './services/passkey-assertion.service';
import { PasskeyChallengeService } from './services/passkey-challenge.service';
import { PasskeyConfigService } from './services/passkey-config.service';
import { PasskeyLoginService } from './services/passkey-login.service';
import { PasskeyManagementService } from './services/passkey-management.service';
import { PasskeyRegistrationService } from './services/passkey-registration.service';
import { PasskeySecondFactorVerifier } from './services/passkey-second-factor.verifier';
import { WebAuthnAdapter } from './services/webauthn.adapter';
import { Passkey, PasskeySchema } from './schemas/passkey.schema';
import {
  PasskeyChallenge,
  PasskeyChallengeSchema,
} from './schemas/passkey-challenge.schema';
import { User, UserSchema } from '../../user/schemas/user.schema';

/**
 * WebAuthn sign-in and passkey management. Sessions and the feature switch
 * come from AuthModule, so this module can be dropped without touching the
 * rest of auth.
 *
 * PasskeySecondFactorVerifier is exported for TwoFactorModule, which accepts a
 * passkey as an answer to a two-factor challenge. Nothing here imports
 * TwoFactorModule, which is what keeps that one-way.
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Passkey.name, schema: PasskeySchema },
      { name: PasskeyChallenge.name, schema: PasskeyChallengeSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [PasskeysController, PasskeyLoginController],
  providers: [
    WebAuthnAdapter,
    PasskeyConfigService,
    PasskeyChallengeService,
    PasskeyRegistrationService,
    PasskeyAssertionService,
    PasskeyLoginService,
    PasskeyManagementService,
    PasskeySecondFactorVerifier,
  ],
  exports: [
    PasskeyAssertionService,
    PasskeyManagementService,
    PasskeySecondFactorVerifier,
  ],
})
export class PasskeysModule {}
