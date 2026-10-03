import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Connection, Model, createConnection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MailCounterService } from './mail-counter.service';
import { MailCounter, MailCounterSchema } from '../schemas/mail-counter.schema';
import { Clock } from '../../common/services/clock';
import {
  MAIL_COUNTER_PURPOSE,
  MAILED_CODE_LIMIT_PER_ADDRESS,
} from '../constants/registration';
import { FrozenClock, TEST_NOW } from '../../../test/utils/frozen-clock';
import { RaceGate } from '../../../test/utils/race-gate';
import {
  SESSION_AUTHORITY_BOOT_TIMEOUT_MS,
  SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS,
} from '../../../test/utils/session-authority-harness';

const ROUNDS = 4;
/** Fifteen minutes, written by hand for the default lifetime. */
const WINDOW_MS = 15 * 60 * 1000;

describe('MailCounterService', () => {
  let mongo: MongoMemoryServer;
  let connection: Connection;
  let counters: Model<MailCounter>;
  let service: MailCounterService;
  let clock: FrozenClock;

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create({ instance: { ip: '127.0.0.1' } });
    connection = await createConnection(mongo.getUri()).asPromise();
    counters = connection.model(MailCounter.name, MailCounterSchema);
    await counters.init();
    clock = new FrozenClock(TEST_NOW);
    const config = {
      get: (key: string, fallback?: number) =>
        key === 'bcrypt.rounds' ? ROUNDS : fallback,
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailCounterService,
        { provide: ConfigService, useValue: config },
        { provide: Clock, useValue: clock },
        { provide: getModelToken(MailCounter.name), useValue: counters },
      ],
    }).compile();
    service = module.get<MailCounterService>(MailCounterService);
  }, SESSION_AUTHORITY_BOOT_TIMEOUT_MS);

  afterAll(async () => {
    await connection.close();
    await mongo.stop();
  }, SESSION_AUTHORITY_TEARDOWN_TIMEOUT_MS);

  beforeEach(async () => {
    clock.set(TEST_NOW);
    await counters.deleteMany({});
  });

  const noticeEmail = 'notice@example.test';

  it('allows the cap and refuses the next notice', async () => {
    for (let count = 0; count < MAILED_CODE_LIMIT_PER_ADDRESS; count += 1) {
      await expect(
        service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE),
      ).resolves.toBe(true);
    }

    await expect(
      service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE),
    ).resolves.toBe(false);
    const record = await counters.findOne({
      email: noticeEmail,
      purpose: MAIL_COUNTER_PURPOSE.NOTICE,
    });
    expect(record?.mailedCodes).toBe(MAILED_CODE_LIMIT_PER_ADDRESS);
  });

  it('rolls the window and allows the address again', async () => {
    for (let count = 0; count < MAILED_CODE_LIMIT_PER_ADDRESS; count += 1) {
      await service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE);
    }
    await expect(
      service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE),
    ).resolves.toBe(false);

    clock.advance(WINDOW_MS);

    await expect(
      service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE),
    ).resolves.toBe(true);
    const record = await counters.findOne({
      email: noticeEmail,
      purpose: MAIL_COUNTER_PURPOSE.NOTICE,
    });
    expect(record?.mailedCodes).toBe(1);
    expect(record?.windowStartedAt).toEqual(
      new Date(TEST_NOW.getTime() + WINDOW_MS),
    );
  });

  it('keeps each purpose on its own counter', async () => {
    for (let count = 0; count < MAILED_CODE_LIMIT_PER_ADDRESS; count += 1) {
      await service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE);
    }

    await expect(
      service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.PASSWORD_RESET),
    ).resolves.toBe(true);
  });

  it('lets two concurrent first notices through and counts both', async () => {
    const firstGate = new RaceGate();
    const secondGate = new RaceGate();
    const originalCreate = counters.create.bind(counters);
    let call = 0;
    const spy = jest.spyOn(counters, 'create').mockImplementation((...args) => {
      const gate = call === 0 ? firstGate : secondGate;
      call += 1;
      return gate.hold().then(() => originalCreate(...args));
    });

    let first: boolean;
    let second: boolean;
    try {
      const firstRequest = Promise.resolve(
        service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE),
      );
      await firstGate.reached(1);
      const secondRequest = Promise.resolve(
        service.tryRecord(noticeEmail, MAIL_COUNTER_PURPOSE.NOTICE),
      );
      await secondGate.reached(1);

      firstGate.release();
      first = await firstRequest;
      secondGate.release();
      second = await secondRequest;
    } finally {
      spy.mockRestore();
    }

    expect([first, second]).toEqual([true, true]);
    const record = await counters.findOne({
      email: noticeEmail,
      purpose: MAIL_COUNTER_PURPOSE.NOTICE,
    });
    expect(record?.mailedCodes).toBe(2);
  });
});
