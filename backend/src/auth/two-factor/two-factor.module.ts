import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth.module';
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
 */
@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    CommonModule,
    AuthModule,
  ],
  controllers: [TwoFactorController],
  providers: [TwoFactorService, TwoFactorLoginService, TwoFactorReauthService],
  exports: [TwoFactorService],
})
export class TwoFactorModule {}
