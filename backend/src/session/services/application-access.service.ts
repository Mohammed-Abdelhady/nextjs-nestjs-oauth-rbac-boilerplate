import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { ClientSession, Connection, Model, Types } from 'mongoose';
import { AppException } from '../../common/exceptions/app.exception';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { AuthEpochService } from '../../common/services/auth-epoch.service';
import { REVOKED_REASON } from '../constants/revoked-reason';
import { SECURITY_EVENT_ACTION } from '../constants/security-event-action';
import {
  Application,
  ApplicationDocument,
} from '../schemas/application.schema';
import {
  UserApplicationGrant,
  UserApplicationGrantDocument,
} from '../schemas/user-application-grant.schema';
import { asAuthorityUnavailable } from '../utils/authority-unavailable';
import { withMajorityTransaction } from '../utils/mongo-transaction';
import { SecurityEventService } from './security-event.service';

@Injectable()
export class ApplicationAccessService {
  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Application.name)
    private readonly applicationModel: Model<ApplicationDocument>,
    @InjectModel(UserApplicationGrant.name)
    private readonly grantModel: Model<UserApplicationGrantDocument>,
    private readonly events: SecurityEventService,
    private readonly authEpoch: AuthEpochService,
  ) {}

  async blockGrant(userId: Types.ObjectId, clientId: string): Promise<void> {
    await this.run(async (session) => {
      const grant = await this.grantModel
        .findOne({ userId, clientId })
        .session(session)
        .exec();
      if (!grant) {
        await this.grantModel.create(
          [
            {
              userId,
              clientId,
              allowed: false,
              sessionVersion: 1,
              issuanceFence: 0,
            },
          ],
          { session },
        );
        await this.events.record(
          {
            targetUserId: userId.toString(),
            clientId,
            action: SECURITY_EVENT_ACTION.GRANT_BLOCKED,
          },
          session,
        );
        return 0;
      }
      await this.grantModel
        .updateOne(
          { _id: grant._id },
          { $set: { allowed: false }, $inc: { sessionVersion: 1 } },
        )
        .session(session)
        .exec();
      await this.events.record(
        {
          targetUserId: userId.toString(),
          clientId,
          action: SECURITY_EVENT_ACTION.GRANT_BLOCKED,
        },
        session,
      );
      return 1;
    });
  }

  async disableApplication(clientId: string): Promise<void> {
    await this.run(async (session) => {
      const environment = this.authEpoch.environment();
      const result = await this.applicationModel
        .updateOne(
          { clientId, environment },
          { $set: { enabled: false }, $inc: { sessionVersion: 1 } },
        )
        .session(session)
        .exec();
      if (result.matchedCount !== 1) {
        throw new AppException(
          ErrorCode.APPLICATION_NOT_FOUND,
          'Application is not registered',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.events.record(
        {
          clientId,
          action: SECURITY_EVENT_ACTION.APPLICATION_DISABLED,
          reasonCode: REVOKED_REASON.APPLICATION_DISABLED,
        },
        session,
      );
      return result.modifiedCount;
    });
  }

  async enableApplication(clientId: string): Promise<void> {
    await this.run(async (session) => {
      const environment = this.authEpoch.environment();
      const result = await this.applicationModel
        .updateOne({ clientId, environment }, { $set: { enabled: true } })
        .session(session)
        .exec();
      if (result.matchedCount !== 1) {
        throw new AppException(
          ErrorCode.APPLICATION_NOT_FOUND,
          'Application is not registered',
          HttpStatus.NOT_FOUND,
        );
      }
      await this.events.record(
        {
          clientId,
          action: SECURITY_EVENT_ACTION.APPLICATION_ENABLED,
        },
        session,
      );
      return result.modifiedCount;
    });
  }

  private async run(
    work: (session: ClientSession) => Promise<number>,
  ): Promise<number> {
    try {
      return await withMajorityTransaction(this.connection, work);
    } catch (error) {
      asAuthorityUnavailable(error);
    }
  }
}
