import { ConfigService } from '@nestjs/config';
import { Connection, createConnection, Model } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { VerificationCodeService } from './verification-code.service';
import {
  PendingRegistration,
  PendingRegistrationDocument,
  PendingRegistrationSchema,
} from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { ErrorCode } from '../../common/enums/error-code.enum';

describe('VerificationCodeService concurrency', () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let model: Model<PendingRegistrationDocument>;
  let service: VerificationCodeService;
  let hashService: HashService;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    connection = await createConnection(mongo.getUri()).asPromise();
    model = connection.model(
      PendingRegistration.name,
      PendingRegistrationSchema,
    ) as unknown as Model<PendingRegistrationDocument>;
    const config = {
      get: (_key: string, fallback?: number) => fallback ?? 4,
    } as unknown as ConfigService;
    hashService = new HashService({
      get: (_key: string, fallback?: number) => fallback ?? 4,
    } as unknown as ConfigService);
    service = new VerificationCodeService(model, hashService, config);
  });

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  });

  beforeEach(async () => {
    await model.deleteMany({});
  });

  it('should let only one concurrent valid activation consume the record', async () => {
    const pending = await service.createOrUpdatePendingRegistration(
      'user@example.com',
      'Test User',
      'hashed-password',
    );

    const results = await Promise.allSettled([
      service.verifyAndConsumeRegistration('user@example.com', pending.code),
      service.verifyAndConsumeRegistration('user@example.com', pending.code),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(await model.findOne({ email: 'user@example.com' })).toBeNull();
  });

  it('should cap concurrent wrong-code attempts at the configured limit', async () => {
    await service.createOrUpdatePendingRegistration(
      'user@example.com',
      'Test User',
      'hashed-password',
    );

    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        service.verifyAndConsumeRegistration('user@example.com', '000000'),
      ),
    );

    const invalid = results.filter(
      (result) =>
        result.status === 'rejected' &&
        (result.reason as { code?: string }).code ===
          ErrorCode.ACTIVATION_CODE_INVALID,
    );
    const capped = results.filter(
      (result) =>
        result.status === 'rejected' &&
        (result.reason as { code?: string }).code ===
          ErrorCode.MAX_ATTEMPTS_EXCEEDED,
    );

    expect(invalid.length + capped.length).toBe(8);
    expect(invalid.length).toBeLessThanOrEqual(5);
  });

  it('should not consume a reissued code from a compare that started on the old generation', async () => {
    const first = await service.createOrUpdatePendingRegistration(
      'user@example.com',
      'Test User',
      'hashed-password',
    );

    let releaseCompare: () => void = () => undefined;
    const delayed = new Promise<void>((resolve) => {
      releaseCompare = resolve;
    });
    const originalCompare = hashService.compare.bind(hashService);
    jest
      .spyOn(HashService.prototype, 'compare')
      .mockImplementation(async (plain, hash) => {
        await delayed;
        return originalCompare(plain, hash);
      });

    const consume = service.verifyAndConsumeRegistration(
      'user@example.com',
      first.code,
    );
    await service.createOrUpdatePendingRegistration(
      'user@example.com',
      'Test User',
      'hashed-password',
    );
    releaseCompare();

    await expect(consume).rejects.toMatchObject({
      code: ErrorCode.ACTIVATION_CODE_INVALID,
    });
    expect(
      await model.findOne({ email: { $eq: 'user@example.com' } }),
    ).not.toBeNull();
    jest.restoreAllMocks();
  });

  it('should refuse consume when the reserved generation expires during compare', async () => {
    const pending = await service.createOrUpdatePendingRegistration(
      'user@example.com',
      'Test User',
      'hashed-password',
    );

    let releaseCompare: () => void = () => undefined;
    const delayed = new Promise<void>((resolve) => {
      releaseCompare = resolve;
    });
    let compareStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      compareStarted = resolve;
    });
    const originalCompare = hashService.compare.bind(hashService);
    jest
      .spyOn(HashService.prototype, 'compare')
      .mockImplementation(async (plain, hash) => {
        compareStarted();
        await delayed;
        return originalCompare(plain, hash);
      });

    const consume = service.verifyAndConsumeRegistration(
      'user@example.com',
      pending.code,
    );
    await started;
    await model.updateMany(
      { email: 'user@example.com' },
      { $set: { expiresAt: new Date(Date.now() - 1000) } },
    );
    releaseCompare();

    await expect(consume).rejects.toMatchObject({
      code: ErrorCode.ACTIVATION_CODE_INVALID,
    });
    jest.restoreAllMocks();
  });
});
