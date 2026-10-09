import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { isMongoDuplicateKeyError } from '../../common/utils/mongo-error.util';
import {
  ADMIN_CLIENT_ID,
  APPLICATION_CLIENT_TYPE,
  APPLICATION_PLATFORM,
  DEFAULT_API_AUDIENCE,
  NATIVE_APPLICATIONS_CONFIG_VARIABLE,
  WEB_CLIENT_ID,
} from '../constants/client-ids';
import {
  ADMIN_ABSOLUTE_LIFETIME_MS,
  ADMIN_IDLE_LIFETIME_MS,
  NATIVE_ABSOLUTE_LIFETIME_MS,
  NATIVE_IDLE_LIFETIME_MS,
  WEB_ABSOLUTE_LIFETIME_MS,
  WEB_IDLE_LIFETIME_MS,
} from '../constants/session-policy';
import type { NativeApplicationConfiguration } from '../../config/types/native-application.type';
import {
  Application,
  ApplicationDocument,
} from '../schemas/application.schema';
import { linearizable } from '../utils/authority/linearizable-query';
import { withMajorityTransaction } from '../utils/transactions/mongo-transaction';

@Injectable()
export class ApplicationRegistryService {
  constructor(
    @InjectModel(Application.name)
    private readonly applicationModel: Model<ApplicationDocument>,
    private readonly authEpoch: AuthEpochService,
    @InjectConnection() private readonly connection: Connection,
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

  async reconcileNativeApplications(): Promise<void> {
    if (!this.authEpoch.nativeEnabled()) {
      return;
    }

    const environment = this.authEpoch.environment();
    const applications = this.authEpoch.nativeApplications();
    await withMajorityTransaction(this.connection, async (session) => {
      await this.throwOnConflictingApplication(
        applications,
        environment,
        session,
      );
      for (const application of applications) {
        await this.upsertNativeApplication(application, environment, session);
      }

      await this.applicationModel
        .updateMany(
          {
            environment,
            platform: APPLICATION_PLATFORM.NATIVE,
            enabled: { $ne: false },
            clientId: { $nin: applications.map(({ clientId }) => clientId) },
          },
          { $set: { enabled: false }, $inc: { sessionVersion: 1 } },
          { session },
        )
        .exec();
    });
  }

  private async throwOnConflictingApplication(
    applications: NativeApplicationConfiguration[],
    environment: string,
    session: ClientSession,
  ): Promise<void> {
    if (applications.length === 0) {
      return;
    }
    const existing = await this.applicationModel
      .find(
        {
          clientId: { $in: applications.map(({ clientId }) => clientId) },
          environment,
        },
        { clientId: 1, platform: 1, clientType: 1 },
      )
      .session(session)
      .lean()
      .exec();
    const byClientId = new Map(existing.map((item) => [item.clientId, item]));
    for (const application of applications) {
      const found = byClientId.get(application.clientId);
      if (
        found &&
        (found.platform !== APPLICATION_PLATFORM.NATIVE ||
          found.clientType !== APPLICATION_CLIENT_TYPE.PUBLIC)
      ) {
        throw new Error(
          `${NATIVE_APPLICATIONS_CONFIG_VARIABLE} entry ${JSON.stringify(application.clientId)}: client id belongs to an application of another kind.`,
        );
      }
    }
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

  private async upsertNativeApplication(
    input: NativeApplicationConfiguration,
    environment: string,
    session: ClientSession,
  ): Promise<void> {
    const filter = {
      clientId: input.clientId,
      environment,
      platform: APPLICATION_PLATFORM.NATIVE,
      clientType: APPLICATION_CLIENT_TYPE.PUBLIC,
    };
    const update = [
      {
        $set: {
          clientId: { $literal: input.clientId },
          environment: { $literal: environment },
          displayName: { $literal: input.displayName },
          platform: APPLICATION_PLATFORM.NATIVE,
          clientType: APPLICATION_CLIENT_TYPE.PUBLIC,
          enabled: true,
          redirectUris: { $literal: input.redirectUris },
          allowedOrigins: [],
          audiences: [DEFAULT_API_AUDIENCE],
          allowedScopes: { $literal: input.allowedScopes },
          createdAt: { $ifNull: ['$createdAt', '$$NOW'] },
          policy: {
            absoluteLifetimeMs: NATIVE_ABSOLUTE_LIFETIME_MS,
            idleLifetimeMs: NATIVE_IDLE_LIFETIME_MS,
          },
          sessionVersion: {
            $add: [
              { $ifNull: ['$sessionVersion', 0] },
              {
                $cond: [
                  {
                    $or: [
                      { $eq: ['$enabled', false] },
                      {
                        $gt: [
                          {
                            $size: {
                              $setDifference: [
                                { $ifNull: ['$redirectUris', []] },
                                { $literal: input.redirectUris },
                              ],
                            },
                          },
                          0,
                        ],
                      },
                    ],
                  },
                  1,
                  0,
                ],
              },
            ],
          },
          policyVersion: { $ifNull: ['$policyVersion', 0] },
        },
      },
    ];

    try {
      await this.applicationModel
        .updateOne(filter, update, { upsert: true, session })
        .exec();
    } catch (error) {
      if (!isMongoDuplicateKeyError(error)) {
        throw error;
      }
      const result = await this.applicationModel
        .updateOne(filter, update, { session })
        .exec();
      if (result.matchedCount !== 1) {
        const existingApplication = await this.applicationModel
          .exists({ clientId: input.clientId, environment })
          .session(session)
          .exec();
        if (existingApplication) {
          throw new Error(
            `${NATIVE_APPLICATIONS_CONFIG_VARIABLE} entry ${JSON.stringify(input.clientId)}: client id belongs to an application of another kind.`,
          );
        }
        throw error;
      }
    }
  }
}
