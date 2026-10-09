import { UnitOfWork } from '../../../src/common/persistence/unit-of-work';
import {
  RecordSecurityEventInput,
  SecurityEventRecorder,
} from '../../../src/session/events/security-event-recorder';
import { NativeSecurityEvents } from '../../../src/session/native/credentials/native-security-events';

/** Writes through the recorder every converted workflow uses. */
export class PostgresNativeSecurityEvents extends NativeSecurityEvents {
  constructor(private readonly recorder: SecurityEventRecorder) {
    super();
  }

  record(
    unitOfWork: UnitOfWork,
    event: RecordSecurityEventInput,
  ): Promise<void> {
    return this.recorder.record(unitOfWork, event);
  }

  recordOutsideUnitOfWork(event: RecordSecurityEventInput): Promise<void> {
    return this.recorder.recordOutsideUnitOfWork(event);
  }
}
