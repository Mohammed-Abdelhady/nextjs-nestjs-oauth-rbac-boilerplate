import { Types } from 'mongoose';
import { AdminUsersService } from './admin-users.service';
import {
  bootLoggingServices,
  LoggingServices,
  captureLogs,
  loggedCalls,
  LOGGING_USER_ID,
} from '../../../test/utils/logging-services';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../test/utils/session-authority-harness';

describe('AdminUsersService logging with real repositories', () => {
  let fixture: LoggingServices;
  beforeAll(async () => {
    fixture = await bootLoggingServices([]);
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);
  beforeEach(async () => {
    await fixture.reset();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });
  afterAll(async () => {
    await fixture?.close();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  it('logs a created user with the user id, never the address', async () => {
    jest
      .spyOn(Types.ObjectId, 'generate')
      .mockReturnValue(Buffer.from(LOGGING_USER_ID, 'hex'));
    const log = captureLogs();
    await fixture.module.get(AdminUsersService).createUser(
      {
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123!',
        role: 'user',
      },
      'admin',
    );
    expect(loggedCalls(log)).toContain('userId=507f1f77bcf86cd799439011');
    expect(loggedCalls(log)).not.toContain('new@example.com');
  });
});
