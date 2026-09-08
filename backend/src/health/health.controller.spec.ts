import { Test, TestingModule } from '@nestjs/testing';
import { HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { HealthController } from './health.controller';
import { HealthService, HealthResponse } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockHealthService = {
    getHealth: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: mockHealthService,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHealth', () => {
    it('should return healthy status when database is connected', () => {
      const healthData: HealthResponse = {
        status: 'healthy',
        timestamp: '2026-09-03T00:00:00.000Z',
      };

      mockHealthService.getHealth.mockReturnValue(healthData);
      const statusMock = jest.fn();
      const mockRes = { status: statusMock } as unknown as Response;

      const result = controller.getHealth(mockRes);

      expect(mockHealthService.getHealth).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalled();
      expect(result).toEqual(healthData);
    });

    it('should set status 503 and return unhealthy status when database is disconnected', () => {
      const healthData: HealthResponse = {
        status: 'unhealthy',
        timestamp: '2026-09-03T00:00:00.000Z',
      };

      mockHealthService.getHealth.mockReturnValue(healthData);
      const statusMock = jest.fn();
      const mockRes = { status: statusMock } as unknown as Response;

      const result = controller.getHealth(mockRes);

      expect(mockHealthService.getHealth).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
      expect(result).toEqual(healthData);
    });
  });
});
