import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, ConnectionStates } from 'mongoose';

export type HealthStatus = 'healthy' | 'unhealthy';

export interface HealthResponse {
  status: HealthStatus;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  checkDatabaseHealth(): { status: 'connected' | 'disconnected' | 'error' } {
    try {
      const readyState = this.connection.readyState;
      if (readyState === ConnectionStates.connected) {
        return { status: 'connected' };
      }
      return { status: 'disconnected' };
    } catch {
      return { status: 'error' };
    }
  }

  getHealth(): HealthResponse {
    const databaseHealth = this.checkDatabaseHealth();
    const isHealthy = databaseHealth.status === 'connected';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    };
  }
}
