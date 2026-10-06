import { Module } from '@nestjs/common';
import { SessionModule } from '../session.module';
import { NativeAuthorizeService } from './native-authorize.service';
import { NativeAuthorizeBrowserService } from './native-authorize-browser.service';
import { NativeCredentialIssuer } from './native-credential.issuer';
import { NativeOAuthController } from './native-oauth.controller';
import { NativeRefreshService } from './native-refresh.service';
import { NativeTokenService } from './native-token.service';
import { NativeDpopService } from './native-dpop.service';
import { NativeBoundProofService } from './native-bound-proof.service';
import { NativeRefreshRotationService } from './native-refresh-rotation.service';
import { NativeBoundRetryService } from './native-bound-retry.service';
import { NativeRevokeService } from './native-revoke.service';

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
    NativeBoundProofService,
    NativeRefreshRotationService,
    NativeBoundRetryService,
    NativeRevokeService,
  ],
})
export class NativeOAuthModule {}
