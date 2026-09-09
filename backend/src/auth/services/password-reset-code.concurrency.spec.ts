import { ConfigService } from '@nestjs/config';
import { Connection, createConnection, Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { PasswordResetCodeService } from './password-reset-code.service';
import {
  PendingPasswordReset,
  PendingPasswordResetDocument,
  PendingPasswordResetSchema,
} from '../schemas/pending-password-reset.schema';
import { HashService } from '../../common/services/hash.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('PasswordResetCodeService concurrency', () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let model: Model<PendingPasswordResetDocument>;
  let service: PasswordResetCodeService;
  let hashService: HashService;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    connection = await createConnection(mongo.getUri()).asPromise();
    model = connection.model(
      PendingPasswordReset.name,
      PendingPasswordResetSchema,
    ) as unknown as Model<PendingPasswordResetDocument>;
    const config = {
      get: (_key: string, fallback?: number) => fallback ?? 4,
    } as unknown as ConfigService;
    hashService = new HashService({
      get: (_key: string, fallback?: number) => fallback ?? 4,
    } as unknown as ConfigService);
    service = new PasswordResetCodeService(model, hashService, config);
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
  });

  it('should let only one of two concurrent valid consumes change the password', async () => {
    const code = await service.createOrUpdatePasswordReset('user@example.com');

    const reserved = await Promise.all([
      service.verifyPasswordReset('user@example.com', code),
      service.verifyPasswordReset('user@example.com', code),
    ]);

    const consumed = await Promise.all([
      service.consumePasswordReset(reserved[0].id, reserved[0].hashedCode),
      service.consumePasswordReset(reserved[1].id, reserved[1].hashedCode),
    ]);

    expect(consumed.filter(Boolean)).toHaveLength(1);
    expect(await model.findOne({ email: 'user@example.com' })).toBeNull();
  });

  it('should cap concurrent wrong-code attempts at the configured limit', async () => {
    await service.createOrUpdatePasswordReset('user@example.com');

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        service.verifyPasswordReset('user@example.com', '000000'),
      ),
    );

    const invalid = results.filter(
      (result) =>
        result.status === 'rejected' &&
        (result.reason as { code?: string }).code ===
          ErrorCode.PASSWORD_RESET_CODE_INVALID,
    );
    const capped = results.filter(
      (result) =>
        result.status === 'rejected' &&
        (result.reason as { code?: string }).code ===
          ErrorCode.MAX_ATTEMPTS_EXCEEDED,
    );

    expect(invalid.length + capped.length).toBe(8);
    expect(invalid.length).toBeLessThanOrEqual(5);
    expect(capped.length).toBeGreaterThanOrEqual(3);
  });

  it('should refuse consume after the reserved generation expires', async () => {
    const code = await service.createOrUpdatePasswordReset('user@example.com');
    const reserved = await service.verifyPasswordReset(
      'user@example.com',
      code,
    );

    await model.updateOne(
      { _id: reserved.id },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );

    await expect(
      service.consumePasswordReset(reserved.id, reserved.hashedCode),
    ).resolves.toBe(false);
  });

  it('should not consume a reissued generation from a stale reservation', async () => {
    const first = await service.createOrUpdatePasswordReset('user@example.com');
    const reserved = await service.verifyPasswordReset(
      'user@example.com',
      first,
    );

    await service.createOrUpdatePasswordReset('user@example.com');

    await expect(
      service.consumePasswordReset(reserved.id, reserved.hashedCode),
    ).resolves.toBe(false);
    expect(
      await model.findOne({ email: { $eq: 'user@example.com' } }),
    ).not.toBeNull();
  });
});
