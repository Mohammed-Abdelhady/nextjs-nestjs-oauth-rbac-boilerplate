import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as bcrypt from 'bcrypt';
import { VerificationCodeService } from './verification-code.service';
import {
  PendingRegistration,
  PendingRegistrationSchema,
} from '../schemas/pending-registration.schema';
import { HashService } from '../../common/services/hash.service';
import { Clock } from '../../common/services/clock';
import { ErrorCode } from '../../common/enums/error-code.enum';
import { rejectionOf } from '../../../test/utils/rejection';
import { FrozenClock, TEST_NOW } from '../../../test/utils/frozen-clock';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../test/utils/session-authority-harness';

const ROUNDS = 4;
const LIVE_EXPIRY = new Date(TEST_NOW.getTime() + 600000);
const EXPIRED_EXPIRY = new Date(TEST_NOW.getTime() - 1000);

/**
 * What a stored pending registration means, against the real database. The
 * concurrent cases live in the e2e race specs.
 */
describe('VerificationCodeService pending registration', () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let registrations: Model<PendingRegistration>;
  let service: VerificationCodeService;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    connection = await createConnection(mongo.getUri()).asPromise();
    registrations = connection.model<PendingRegistration>(
      PendingRegistration.name,
      PendingRegistrationSchema,
    );
    await registrations.init();
    const config = {
      get: (key: string, fallback?: number) =>
        key === 'bcrypt.rounds' ? ROUNDS : fallback,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VerificationCodeService,
        HashService,
        { provide: ConfigService, useValue: config },
        { provide: Clock, useValue: new FrozenClock(TEST_NOW) },
        {
          provide: getModelToken(PendingRegistration.name),
          useValue: registrations,
        },
      ],
    }).compile();
    service = module.get<VerificationCodeService>(VerificationCodeService);
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    await registrations.deleteMany({});
  });

  async function stored(email: string) {
    const record = await registrations
      .findOne({ email })
      .select('+hashedPassword +hashedCode');
    if (!record) throw new Error(`expected a stored record for ${email}`);
    return record;
  }

  it('refreshes the code of a live record and keeps its name and password', async () => {
    const originalPassword = await bcrypt.hash('original-password', ROUNDS);
    await registrations.create({
      email: 'live@example.test',
      name: 'Original',
      hashedPassword: originalPassword,
      hashedCode: 'old-code',
      attempts: 3,
      expiresAt: LIVE_EXPIRY,
    });

    const result = await service.createOrUpdatePendingRegistration(
      'live@example.test',
      'Second',
      await bcrypt.hash('second-password', ROUNDS),
    );

    const record = await stored('live@example.test');
    expect(result.name).toBe('Original');
    expect(result.code).toMatch(/^\d{6}$/);
    expect(record.name).toBe('Original');
    expect(record.hashedPassword).toBe(originalPassword);
    expect(record.attempts).toBe(0);
    expect(await bcrypt.compare(result.code, record.hashedCode)).toBe(true);
  });

  it('extends the expiry of a live record', async () => {
    await registrations.create({
      email: 'extend@example.test',
      name: 'Live',
      hashedPassword: await bcrypt.hash('old-password', ROUNDS),
      hashedCode: 'old-code',
      attempts: 3,
      expiresAt: LIVE_EXPIRY,
    });

    await service.createOrUpdatePendingRegistration(
      'extend@example.test',
      'Second',
      await bcrypt.hash('second-password', ROUNDS),
    );

    const record = await stored('extend@example.test');
    expect(record.expiresAt.getTime()).toBeGreaterThan(LIVE_EXPIRY.getTime());
  });

  it('replaces an expired record with the new details', async () => {
    const newPassword = await bcrypt.hash('new-password', ROUNDS);
    await registrations.create({
      email: 'expired@example.test',
      name: 'Old',
      hashedPassword: await bcrypt.hash('old-password', ROUNDS),
      hashedCode: 'old-code',
      attempts: 3,
      expiresAt: EXPIRED_EXPIRY,
    });

    const result = await service.createOrUpdatePendingRegistration(
      'expired@example.test',
      'New',
      newPassword,
    );

    const record = await stored('expired@example.test');
    expect(result.name).toBe('New');
    expect(record.name).toBe('New');
    expect(record.hashedPassword).toBe(newPassword);
    expect(record.attempts).toBe(0);
    expect(await bcrypt.compare(result.code, record.hashedCode)).toBe(true);
  });

  it('creates exactly one record when none is pending', async () => {
    const result = await service.createOrUpdatePendingRegistration(
      'new@example.test',
      'New',
      await bcrypt.hash('new-password', ROUNDS),
    );

    const record = await stored('new@example.test');
    expect(result.name).toBe('New');
    expect(record.name).toBe('New');
    expect(
      await registrations.countDocuments({ email: 'new@example.test' }),
    ).toBe(1);
    expect(await bcrypt.compare(result.code, record.hashedCode)).toBe(true);
  });

  it('clears the password hash when an email change replaces an expired record', async () => {
    await registrations.create({
      email: 'change@example.test',
      name: 'Old',
      hashedPassword: await bcrypt.hash('old-password', ROUNDS),
      hashedCode: 'old-code',
      attempts: 3,
      expiresAt: EXPIRED_EXPIRY,
    });

    const result = await service.createOrUpdatePendingRegistration(
      'change@example.test',
      'Moved',
    );

    const record = await stored('change@example.test');
    expect(result.name).toBe('Moved');
    expect(record.name).toBe('Moved');
    expect(record.hashedPassword).toBeUndefined();
    expect(await bcrypt.compare(result.code, record.hashedCode)).toBe(true);
  });

  it('treats an empty stored name as a match and keeps the record', async () => {
    const email = 'empty-name@example.test';
    const originalPassword = await bcrypt.hash('original-password', ROUNDS);
    await registrations.create({
      email,
      name: 'Placeholder',
      hashedPassword: originalPassword,
      hashedCode: 'old-code',
      attempts: 0,
      expiresAt: LIVE_EXPIRY,
    });
    // The schema requires a name, so seed the empty one without validation.
    await registrations.collection.updateOne({ email }, { $set: { name: '' } });

    const result = await service.createOrUpdatePendingRegistration(
      email,
      'Second',
      await bcrypt.hash('second-password', ROUNDS),
    );

    const record = await stored(email);
    expect(result.name).toBe('');
    expect(record.name).toBe('');
    expect(record.hashedPassword).toBe(originalPassword);
    expect(await bcrypt.compare(result.code, record.hashedCode)).toBe(true);
    expect(await registrations.countDocuments({ email })).toBe(1);
  });

  it('does not delete a live locked record it could not reserve', async () => {
    const email = 'locked-verify@example.test';
    await registrations.create({
      email,
      name: 'Locked',
      hashedCode: await bcrypt.hash('123456', ROUNDS),
      attempts: 5,
      expiresAt: LIVE_EXPIRY,
    });

    const rejection = await rejectionOf(
      service.verifyAndConsumeRegistration(email, '123456'),
    );

    expect(rejection.getCode()).toBe(ErrorCode.ACTIVATION_CODE_INVALID);
    expect(await registrations.countDocuments({ email })).toBe(1);
  });

  it('deletes an expired record it could not reserve and answers the one code', async () => {
    await registrations.create({
      email: 'expired-verify@example.test',
      name: 'Expired',
      hashedCode: await bcrypt.hash('123456', ROUNDS),
      attempts: 0,
      expiresAt: EXPIRED_EXPIRY,
    });

    const rejection = await rejectionOf(
      service.verifyAndConsumeRegistration(
        'expired-verify@example.test',
        '123456',
      ),
    );

    expect(rejection.getCode()).toBe(ErrorCode.ACTIVATION_CODE_INVALID);
    expect(rejection.getDetails()).toBeUndefined();
    expect(
      await registrations.countDocuments({
        email: 'expired-verify@example.test',
      }),
    ).toBe(0);
  });
});
