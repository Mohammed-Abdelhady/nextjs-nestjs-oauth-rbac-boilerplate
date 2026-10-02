import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ClientSession, Model } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import {
  ADMIN_CLIENT_ID,
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
  WEB_CLIENT_ID,
} from '../constants/client-ids';
import {
  ADMIN_ABSOLUTE_LIFETIME_MS,
  ADMIN_IDLE_LIFETIME_MS,
  WEB_ABSOLUTE_LIFETIME_MS,
  WEB_IDLE_LIFETIME_MS,
} from '../constants/session-policy';
import {
  Application,
  ApplicationDocument,
} from '../schemas/application.schema';
import { linearizable } from '../utils/linearizable-query';

@Injectable()
export class ApplicationRegistryService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<ApplicationDocument>,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async requireEnabled(
    clientId: string,
    session?: ClientSession,
  ): Promise<ApplicationDocument> {
    const environment = this.authEpoch.environment();
    const query = this.applicationModel.findOne({ clientId, environment });
    const application = session
      ? await query.session(session).exec()
      : await linearizable(query).exec();

    if (!application) {
      throw new AppException(
        ErrorCode.APPLICATION_NOT_FOUND,
        'Application is not registered',
        HttpStatus.NOT_FOUND,
      );
    }

    if (!application.enabled) {
      throw new AppException(
        ErrorCode.APPLICATION_DISABLED,
        'Application is disabled',
        HttpStatus.FORBIDDEN,
      );
    }

    return application;
  }

  async findByClientId(clientId: string): Promise<ApplicationDocument | null> {
    const environment = this.authEpoch.environment();
    return linearizable(
      this.applicationModel.findOne({ clientId, environment }),
    ).exec();
  }

  async findByClientIds(
    clientIds: string[],
    session?: ClientSession,
  ): Promise<ApplicationDocument[]> {
    if (clientIds.length === 0) {
      return [];
    }
    const environment = this.authEpoch.environment();
    const query = this.applicationModel.find({
      clientId: { $in: clientIds },
      environment,
    });
    return session ? query.session(session).exec() : linearizable(query).exec();
  }

  async seedFirstPartyApplications(): Promise<void> {
    const environment = this.authEpoch.environment();
    const origin = this.clientOrigin();
    await this.upsertApplication({
      clientId: WEB_CLIENT_ID,
      displayName: 'Web',
      platform: APPLICATION_PLATFORM.WEB,
      environment,
      clientType: APPLICATION_CLIENT_TYPE.PUBLIC,
      allowedOrigins: [origin],
      policy: {
        absoluteLifetimeMs: WEB_ABSOLUTE_LIFETIME_MS,
        idleLifetimeMs: WEB_IDLE_LIFETIME_MS,
      },
    });
    await this.upsertApplication({
      clientId: ADMIN_CLIENT_ID,
      displayName: 'Admin',
      platform: APPLICATION_PLATFORM.ADMIN,
      environment,
      clientType: APPLICATION_CLIENT_TYPE.CONFIDENTIAL,
      allowedOrigins: [],
      policy: {
        absoluteLifetimeMs: ADMIN_ABSOLUTE_LIFETIME_MS,
        idleLifetimeMs: ADMIN_IDLE_LIFETIME_MS,
      },
    });
  }

  async ensureClientOriginAllowed(): Promise<void> {
    await this.applicationModel
      .updateMany(
        {
          environment: this.authEpoch.environment(),
          $or: [
            {
              clientId: WEB_CLIENT_ID,
              platform: APPLICATION_PLATFORM.WEB,
            },
            {
              clientId: ADMIN_CLIENT_ID,
              platform: APPLICATION_PLATFORM.ADMIN,
            },
          ],
        },
        { $addToSet: { allowedOrigins: this.clientOrigin() } },
      )
      .exec();
  }

  private clientOrigin(): string {
    return new URL(this.authEpoch.clientUrl()).origin;
  }

  private async upsertApplication(input: {
    clientId: string;
    displayName: string;
    platform: string;
    environment: string;
    clientType: string;
    allowedOrigins: string[];
    policy: { absoluteLifetimeMs: number; idleLifetimeMs: number };
  }): Promise<void> {
    await this.applicationModel.updateOne(
      { clientId: input.clientId, environment: input.environment },
      {
        $setOnInsert: {
          clientId: input.clientId,
          environment: input.environment,
          enabled: true,
          sessionVersion: 0,
          policyVersion: 0,
          redirectUris: [],
          audiences: [DEFAULT_API_AUDIENCE],
          allowedScopes: [DEFAULT_API_AUDIENCE],
        },
        $set: {
          displayName: input.displayName,
          platform: input.platform,
          clientType: input.clientType,
          allowedOrigins: input.allowedOrigins,
          policy: input.policy,
        },
      },
      { upsert: true },
    );
  }
}
