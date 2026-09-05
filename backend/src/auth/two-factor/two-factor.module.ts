import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth.module';
import { PasskeysModule } from '../passkeys/passkeys.module';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { TwoFactorLoginService } from './two-factor-login.service';
import { TwoFactorReauthService } from './services/two-factor-reauth.service';
import { User, UserSchema } from '../../user/schemas/user.schema';
import { CommonModule } from '../../common/common.module';

/**
 * Routes for the TOTP second factor.
 *
 * The pieces the sign-in paths need, the challenge service and the secret
 * crypto, live in AuthModule instead: password, magic link and OAuth all have
 * to reach them, and importing this module from there would close a cycle.
 *
 * PasskeysModule comes in for the verify route, which takes a passkey as an
 * answer to the challenge. The dependency runs one way: passkeys know nothing
 * about the second factor.
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CommonModule,
    AuthModule,
    PasskeysModule,
  ],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, TwoFactorLoginService, TwoFactorReauthService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
