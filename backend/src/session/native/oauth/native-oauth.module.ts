import { Module } from '@nestjs/common';
import { SessionModule } from '../../session.module';
import { NativeAuthorizeService } from '../authorize/native-authorize.service';
import { NativeAuthorizeBrowserService } from '../authorize/native-authorize-browser.service';
import { NativeCredentialIssuer } from '../token/native-credential.issuer';
import { NativeOAuthController } from './native-oauth.controller';
import { NativeRefreshService } from '../refresh/native-refresh.service';
import { NativeTokenService } from '../token/native-token.service';
import { NativeDpopService } from '../proof/native-dpop.service';
import { NativeBoundProofService } from '../proof/native-bound-proof.service';
import { NativeRefreshRotationService } from '../refresh/native-refresh-rotation.service';
import { NativeBoundRetryService } from '../retry/native-bound-retry.service';
import { NativeRevokeService } from '../revoke/native-revoke.service';

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
