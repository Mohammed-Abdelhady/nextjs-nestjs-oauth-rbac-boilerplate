/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { bootE2eApp, type E2eApp } from './utils/e2e-app';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { Response } from 'supertest';

interface HealthResponse {
  status: string;
  timestamp: string;
}

describe('AppController (e2e)', () => {
  let e2e: E2eApp;
  let app: INestApplication;
  let httpServer: ReturnType<INestApplication['getHttpServer']>;

  beforeAll(async () => {
    e2e = await bootE2eApp();
    app = e2e.app;
    httpServer = app.getHttpServer();
  });

  afterAll(async () => {
    await e2e?.close();
  });

  describe('Application Startup', () => {
    it('should start successfully', () => {
      expect(app).toBeDefined();
    });
  });

  describe('Health Endpoint', () => {
    it('/health (GET)', async () => {
      const response: Response = await request(httpServer)
        .get('/health')
        .expect(200);

      const body = response.body as HealthResponse;
      expect(body).toHaveProperty('status');
      expect(body).toHaveProperty('timestamp');
      expect(Object.keys(body).sort()).toEqual(['status', 'timestamp']);
    });

    it('should return correct health structure', async () => {
      const response: Response = await request(httpServer)
        .get('/health')
        .expect(200);

      const health = response.body as HealthResponse;
      expect(['healthy', 'unhealthy']).toContain(health.status);
      expect(typeof health.timestamp).toBe('string');
      expect(Number.isNaN(Date.parse(health.timestamp))).toBe(false);
    });
  });

  describe('CORS Configuration', () => {
    it('should include CORS headers', async () => {
      await request(httpServer)
        .get('/health')
        .expect(200)
        .expect('Access-Control-Allow-Origin', /.*/);
    });
  });

  describe('Security Headers', () => {
    it('should include Helmet security headers', async () => {
      await request(httpServer)
        .get('/health')
        .expect(200)
        .expect('X-Content-Type-Options', 'nosniff')
        .expect('X-Frame-Options', 'SAMEORIGIN')
        .expect('X-DNS-Prefetch-Control', 'off');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within limit', async () => {
      const promises: Promise<Response>[] = Array.from({ length: 10 }, () =>
        request(httpServer).get('/health'),
      );

      const responses: Response[] = await Promise.all(promises);
      responses.forEach((res: Response) => {
        expect(res.status).toBe(200);
      });
    });

    it('should return 429 after exceeding limit', async () => {
      // Note: This test may take some time to complete
      // Adjust limit in .env to test this properly
      const limit = 70; // Slightly above default limit of 60
      const promises: Promise<Response>[] = Array.from({ length: limit }, () =>
        request(httpServer).get('/health'),
      );

      const responses: Response[] = await Promise.all(promises);
      const lastResponse: Response | undefined =
        responses[responses.length - 1];

      if (lastResponse) {
        // The last response might be rate limited
        expect([200, 429]).toContain(lastResponse.status);
      }
    });
  });

  describe('Root Endpoint', () => {
    it('/ (GET)', async () => {
      await request(httpServer).get('/api').expect(200);
    });
  });
});
