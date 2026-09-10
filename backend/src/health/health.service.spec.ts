import { Test, TestingModule } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';
import { HealthService } from './health.service';

describe('HealthService (X-11)', () => {
  const buildService = async (
    connection: Partial<Connection>,
  ): Promise<HealthService> => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: getConnectionToken(), useValue: connection },
      ],
    }).compile();

    return module.get<HealthService>(HealthService);
  };

  describe('checkDatabaseHealth', () => {
    it('should report connected when readyState is 1', async () => {
      const service = await buildService({
        readyState: ConnectionStates.connected,
      });

      expect(service.checkDatabaseHealth()).toEqual({ status: 'connected' });
    });

    it('should report disconnected for any other readyState', async () => {
      const service = await buildService({
        readyState: ConnectionStates.disconnected,
      });

      expect(service.checkDatabaseHealth()).toEqual({ status: 'disconnected' });
    });

    it('should report error when reading the connection throws', async () => {
      const connection = {} as Partial<Connection>;
      Object.defineProperty(connection, 'readyState', {
        get: () => {
          throw new Error('connection gone');
        },
      });

      const service = await buildService(connection);

      expect(service.checkDatabaseHealth()).toEqual({ status: 'error' });
    });
  });

  describe('getHealth', () => {
    it('should be healthy while the database is connected', async () => {
      const service = await buildService({
        readyState: ConnectionStates.connected,
      });

      const health = service.getHealth();

      expect(health.status).toBe('healthy');
      expect(Date.parse(health.timestamp)).not.toBeNaN();
    });

    it('should be unhealthy while the database is down', async () => {
      const service = await buildService({
        readyState: ConnectionStates.disconnected,
      });

      expect(service.getHealth().status).toBe('unhealthy');
    });

    it('should not leak uptime, memory or environment (S-22)', async () => {
      const service = await buildService({
        readyState: ConnectionStates.connected,
      });

      expect(Object.keys(service.getHealth()).sort()).toEqual([
        'status',
        'timestamp',
      ]);
    });
  });
});
