import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { HashService } from './hash.service';

jest.mock('bcrypt');

const mockedBcrypt = jest.mocked(bcrypt);
const CONFIGURED_ROUNDS = 4;

describe('HashService', () => {
  let service: HashService;

  const buildService = async (rounds?: number): Promise<HashService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HashService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(
              (_key: string, fallback: number) => rounds ?? fallback,
            ),
          },
        },
      ],
    }).compile();

    return module.get<HashService>(HashService);
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    service = await buildService(CONFIGURED_ROUNDS);
  });

  describe('hash', () => {
    it('should hash with the configured cost', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed' as never);

      const result = await service.hash('plain-text');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith(
        'plain-text',
        CONFIGURED_ROUNDS,
      );
      expect(result).toBe('hashed');
    });

    it('should fall back to 10 rounds when the config holds no value', async () => {
      mockedBcrypt.hash.mockResolvedValue('hashed' as never);
      const fallbackService = await buildService();

      await fallbackService.hash('plain-text');

      expect(mockedBcrypt.hash).toHaveBeenCalledWith('plain-text', 10);
    });
  });

  describe('compare', () => {
    it('should return true when bcrypt matches', async () => {
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await expect(service.compare('plain', 'hash')).resolves.toBe(true);
      expect(mockedBcrypt.compare).toHaveBeenCalledWith('plain', 'hash');
    });

    it('should return false when bcrypt does not match', async () => {
      mockedBcrypt.compare.mockResolvedValue(false as never);

      await expect(service.compare('plain', 'hash')).resolves.toBe(false);
    });
  });
});
