import { Inject, Injectable, Optional } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ClientSession, Connection } from 'mongoose';
import {
  pauseBeforeRerun,
  RerunPause,
  UNIT_OF_WORK_RERUN_PAUSE,
  UnitOfWork,
  UnitOfWorkRunner,
} from '../../../common/persistence/unit-of-work';
import { withMajorityTransaction } from '../../../common/persistence/mongo/mongo-transaction';
import { mapMongoError } from './mongo-persistence-errors';

class MongoUnitOfWork extends UnitOfWork {
  constructor(readonly session: ClientSession) {
    super();
  }
}

/** The transaction's session, for the MongoDB adapter only. */
export function mongoSessionOf(unitOfWork: UnitOfWork): ClientSession {
  if (!(unitOfWork instanceof MongoUnitOfWork)) {
    throw new Error('This unit of work was not opened on MongoDB');
  }
  return unitOfWork.session;
}

/**
 * Lets Mongoose code that still owns its transaction call a converted service.
 * It goes away when that caller moves behind a store.
 */
export function mongoUnitOfWork(session: ClientSession): UnitOfWork {
  return new MongoUnitOfWork(session);
}

@Injectable()
export class MongoUnitOfWorkRunner extends UnitOfWorkRunner {
  private readonly pause: RerunPause;

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Optional() @Inject(UNIT_OF_WORK_RERUN_PAUSE) pause?: RerunPause,
  ) {
    super();
    this.pause = pause ?? pauseBeforeRerun;
  }

  async run<Result>(
    work: (unitOfWork: UnitOfWork) => Promise<Result>,
  ): Promise<Result> {
    try {
      return await withMajorityTransaction(
        this.connection,
        (session) => work(new MongoUnitOfWork(session)),
        this.pause,
      );
    } catch (error) {
      throw mapMongoError(error);
    }
  }
}
