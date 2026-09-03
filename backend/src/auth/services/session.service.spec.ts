import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { SessionService } from './session.service';
import { Session } from '../../session/schemas/session.schema';

describe('SessionService (S-01)', () => {
  let service: SessionService;
  let sessionModel: {
    create: jest.Mock;
    findOne: jest.Mock;
    updateOne: jest.Mock;
    updateMany: jest.Mock;
  };

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

  describe('validateSession', () => {
    it('should return null when populated user is missing', async () => {
      const mockSession = {
        user: null,
        save: jest.fn(),
      };
      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSession),
      });

      const result = await service.validateSession('token-123');
      expect(result).toBeNull();
      expect(mockSession.save).not.toHaveBeenCalled();
    });

    it('should return null when populated user isDeleted', async () => {
      const mockSession = {
        user: {
          _id: new Types.ObjectId(),
          email: 'deleted@example.com',
          isDeleted: true,
        },
        save: jest.fn(),
      };
      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSession),
      });

      const result = await service.validateSession('token-123');
      expect(result).toBeNull();
      expect(mockSession.save).not.toHaveBeenCalled();
    });

    it('should return session when user is active', async () => {
      const mockSession = {
        user: {
          _id: new Types.ObjectId(),
          email: 'active@example.com',
          isDeleted: false,
        },
        save: jest.fn().mockResolvedValue(undefined),
      };
      sessionModel.findOne.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockSession),
      });

      const result = await service.validateSession('token-123');
      expect(result).toBe(mockSession);
      expect(mockSession.save).toHaveBeenCalled();
    });
  });
});
