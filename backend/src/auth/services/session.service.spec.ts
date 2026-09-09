import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { SessionService, hashToken } from './session.service';
import { Session } from '../../session/schemas/session.schema';

describe('SessionService (S-06, D-15, S-01)', () => {
  let service: SessionService;
  let sessionModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
  };

  const rawToken = 'sample-plain-token-123';
  const expectedHash = hashToken(rawToken);

  beforeEach(async () => {
    sessionModel = {
      create: jest.fn(),
      findOne: jest.fn(),
      updateOne: jest.fn(),
      updateMany: jest.fn(),
    };

    const configService = {
      get: jest.fn().mockReturnValue(604800000),
    } as unknown as jest.Mocked<ConfigService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SessionService,
        {
          provide: getModelToken(Session.name),
          useValue: sessionModel,
        },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get<SessionService>(SessionService);
  });

  describe('createSession', () => {
    it('should store tokenHash and return raw token', async () => {
      const userId = new Types.ObjectId();
      sessionModel.create.mockResolvedValue({});

      const token = await service.createSession(
        userId,
        'test-agent',
        '127.0.0.1',
      );

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(sessionModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: userId,
          tokenHash: hashToken(token),
          userAgent: 'test-agent',
          ip: '127.0.0.1',
          device: expect.objectContaining({
            type: expect.any(String),
            browser: expect.any(String),
            os: expect.any(String),
            name: expect.any(String),
          }),
          deviceName: expect.any(String),
        }),
      );
    });
  });

  describe('validateSession', () => {
    it('should return null when populated user is missing', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        user: null,
        lastUsedAt: new Date(Date.now() - 600000),
      };

      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSession),
          }),
        }),
      });

      const result = await service.validateSession(rawToken);
      expect(result).toBeNull();
      expect(sessionModel.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          tokenHash: expectedHash,
        }),
      );
      expect(sessionModel.updateOne).not.toHaveBeenCalled();
    });

    it('should return null when populated user isDeleted', async () => {
      const mockSession = {
        _id: new Types.ObjectId(),
        user: {
          _id: new Types.ObjectId(),
          email: 'deleted@example.com',
          isDeleted: true,
        },
        lastUsedAt: new Date(Date.now() - 600000),
      };

      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSession),
          }),
        }),
      });

      const result = await service.validateSession(rawToken);
      expect(result).toBeNull();
      expect(sessionModel.updateOne).not.toHaveBeenCalled();
    });

    it('should update lastUsedAt with updateOne when older than 5 minutes', async () => {
      const sessionId = new Types.ObjectId();
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      const mockSession = {
        _id: sessionId,
        user: {
          _id: new Types.ObjectId(),
          email: 'active@example.com',
          isDeleted: false,
        },
        lastUsedAt: tenMinutesAgo,
      };

      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSession),
          }),
        }),
      });
      sessionModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.validateSession(rawToken);
      expect(result).toBeDefined();
      expect(sessionModel.updateOne).toHaveBeenCalledWith(
        { _id: sessionId },
        expect.objectContaining({
          $set: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
        }),
      );
    });

    it('should NOT update lastUsedAt when used within 5 minutes', async () => {
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const mockSession = {
        _id: new Types.ObjectId(),
        user: {
          _id: new Types.ObjectId(),
          email: 'active@example.com',
          isDeleted: false,
        },
        lastUsedAt: oneMinuteAgo,
      };

      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue(mockSession),
          }),
        }),
      });

      const result = await service.validateSession(rawToken);
      expect(result).toBeDefined();
      expect(sessionModel.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('invalidateSession', () => {
    it('should hash token before updating isValid', async () => {
      sessionModel.updateOne.mockResolvedValue({ modifiedCount: 1 });

      const result = await service.invalidateSession(rawToken);
      expect(result).toBe(true);
      expect(sessionModel.updateOne).toHaveBeenCalledWith(
        { tokenHash: expectedHash },
        { isValid: false },
      );
    });
  });

  describe('invalidateAllSessionsExcept', () => {
    it('should hash exceptToken before updating', async () => {
      const userId = new Types.ObjectId();
      sessionModel.updateMany.mockResolvedValue({ modifiedCount: 3 });

      const count = await service.invalidateAllSessionsExcept(userId, rawToken);
      expect(count).toBe(3);
      expect(sessionModel.updateMany).toHaveBeenCalledWith(
        {
          user: userId,
          tokenHash: { $ne: expectedHash },
          isValid: true,
        },
        { isValid: false },
      );
    });
  });

  describe('getSessionByToken', () => {
    it('should hash token when looking up session', async () => {
      const mockSession = { _id: new Types.ObjectId() };
      sessionModel.findOne.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockSession),
        }),
      });

      const result = await service.getSessionByToken(rawToken);
      expect(result).toBe(mockSession);
      expect(sessionModel.findOne).toHaveBeenCalledWith({
        tokenHash: expectedHash,
      });
    });
  });
});
