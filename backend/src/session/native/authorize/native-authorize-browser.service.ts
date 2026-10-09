import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AppException } from '../../../common/exceptions/app.exception';
import { ErrorCode } from '../../../common/enums/error-code.enum';
import { Clock } from '../../../common/services/clock';
import { AuthEpochService } from '../../../common/services/auth-epoch.service';
import {
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
} from '../../constants/client-ids';
import {
  Application,
  ApplicationDocument,
} from '../../schemas/application.schema';
import {
  AuthorizationTransaction,
  AuthorizationTransactionDocument,
} from '../../schemas/authorization-transaction.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../../schemas/user-application-grant.schema';
import {
  NATIVE_AUTH_INTENT,
  NativeAuthorizeTransactionDetails,
  OAUTH_ERROR,
} from '../oauth/native-oauth.types';
import { isAcceptableRedirectUri } from '../../utils/oauth/redirect-uri.util';
import type { RedirectUriPolicy } from '../../utils/oauth/redirect-uri.util';
import { matchesRegisteredRedirectUri } from '../../utils/oauth/redirect-uri.util';

@Injectable()
export class NativeAuthorizeBrowserService {
  constructor(
    @InjectModel(AuthorizationTransaction.name)
    private readonly transactions: Model<AuthorizationTransactionDocument>,
    @InjectModel(Application.name)
    private readonly applications: Model<ApplicationDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grants: Model<UserApplicationGrantDocument>,
    private readonly clock: Clock,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async getTransaction(
    userId: string,
    transactionId: string,
  ): Promise<NativeAuthorizeTransactionDetails> {
    this.assertNativeEnabled();
    const now = this.clock.now();
    const transaction = await this.transactions
      .findOne({
        transactionId,
        intent: NATIVE_AUTH_INTENT,
        consumed: false,
        codeHash: { $exists: false },
        expiresAt: { $gt: now },
      })
      .exec();
    if (!transaction) {
      throw expiredTransaction();
    }

    const application = await this.applicationForTransaction(transaction);

    const grant = await this.grants
      .findOne({ userId, clientId: transaction.clientId })
      .select('allowed')
      .exec();

    return {
      applicationName: application.displayName,
      platform: application.platform,
      expiresAt: transaction.expiresAt.toISOString(),
      alreadyGranted: grant?.allowed === true,
    };
  }

  async deny(transactionId: string): Promise<{ redirectUri: string }> {
    this.assertNativeEnabled();
    const pending = await this.transactions
      .findOne({
        transactionId,
        intent: NATIVE_AUTH_INTENT,
        consumed: false,
        codeHash: { $exists: false },
        expiresAt: { $gt: this.clock.now() },
      })
      .exec();
    if (!pending) {
      throw expiredTransaction();
    }
    await this.applicationForTransaction(pending);
    const transaction = await this.transactions
      .findOneAndUpdate(
        {
          _id: pending._id,
          transactionId: pending.transactionId,
          intent: NATIVE_AUTH_INTENT,
          consumed: false,
          codeHash: { $exists: false },
          expiresAt: { $gt: this.clock.now() },
          redirectUri: pending.redirectUri,
        },
        { $set: { consumed: true } },
        { new: true },
      )
      .exec();
    if (!transaction) {
      throw expiredTransaction();
    }

    const target = new URL(transaction.redirectUri);
    target.searchParams.set('error', OAUTH_ERROR.ACCESS_DENIED);
    target.searchParams.set('state', transaction.state);
    return { redirectUri: target.toString() };
  }

  private async applicationForTransaction(
    transaction: AuthorizationTransactionDocument,
  ): Promise<ApplicationDocument> {
    if (
      !isAcceptableRedirectUri(transaction.redirectUri, this.redirectPolicy())
    ) {
      throw expiredTransaction();
    }
    const application = await this.applications
      .findOne({
        clientId: transaction.clientId,
        environment: this.authEpoch.environment(),
        enabled: true,
      })
      .exec();
    if (
      !application ||
      application.platform !== APPLICATION_PLATFORM.NATIVE ||
      application.clientType !== APPLICATION_CLIENT_TYPE.PUBLIC ||
      !application.redirectUris.some((registered) =>
        matchesRegisteredRedirectUri(registered, transaction.redirectUri),
      )
    ) {
      throw expiredTransaction();
    }
    return application;
  }

  private redirectPolicy(): RedirectUriPolicy {
    return {
      nodeEnv: this.authEpoch.environment(),
      allowCustomScheme: this.authEpoch.nativeCustomSchemeAllowed(),
    };
  }

  private assertNativeEnabled(): void {
    if (this.authEpoch.nativeEnabled()) {
      return;
    }
    throw new AppException(
      ErrorCode.NATIVE_AUTH_DISABLED,
      'Native sign-in is disabled',
      HttpStatus.FORBIDDEN,
    );
  }
}

function expiredTransaction(): AppException {
  return new AppException(
    ErrorCode.NATIVE_TRANSACTION_EXPIRED,
    'Native authorization transaction is expired or already ended',
    HttpStatus.NOT_FOUND,
  );
}
