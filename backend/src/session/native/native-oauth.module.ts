import { Module } from '@nestjs/common';
import { SessionModule } from '../session.module';
import { NativeAuthorizeService } from './native-authorize.service';
import { NativeCredentialIssuer } from './native-credential.issuer';
import { NativeOAuthController } from './native-oauth.controller';
import { NativeRefreshService } from './native-refresh.service';
import { NativeTokenService } from './native-token.service';

@Module({
  imports: [SessionModule],
  controllers: [NativeOAuthController],
  providers: [
    NativeAuthorizeService,
    NativeCredentialIssuer,
    NativeRefreshService,
    NativeTokenService,
  ],
})
export class NativeOAuthModule {}
