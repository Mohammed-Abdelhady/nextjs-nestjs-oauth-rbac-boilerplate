import { Module } from '@nestjs/common';
import { SessionModule } from '../session.module';
import { NativeAuthorizeService } from './native-authorize.service';
import { NativeAuthorizeBrowserService } from './native-authorize-browser.service';
import { NativeCredentialIssuer } from './native-credential.issuer';
import { NativeOAuthController } from './native-oauth.controller';
import { NativeRefreshService } from './native-refresh.service';
import { NativeTokenService } from './native-token.service';
import { NativeDpopService } from './native-dpop.service';

@Module({
  imports: [SessionModule],
  controllers: [NativeOAuthController],
  providers: [
    NativeAuthorizeService,
    NativeAuthorizeBrowserService,
    NativeCredentialIssuer,
    NativeRefreshService,
    NativeTokenService,
    NativeDpopService,
  ],
})
export class NativeOAuthModule {}
