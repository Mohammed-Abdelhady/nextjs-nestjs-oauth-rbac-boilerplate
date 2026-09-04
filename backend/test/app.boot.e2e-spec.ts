import request from 'supertest';
import type { Response } from 'supertest';
import { bootE2eApp, type E2eApp } from './utils/e2e-app';

/**
 * Smoke test for the wiring itself: the whole AppModule has to compile and
 * answer on its two unauthenticated routes. It catches provider graph breakage,
 * such as a global guard whose dependencies do not resolve.
 *
 * Runs against the MONGO_URI of the environment, like the other e2e suites. To
 * run it without a database, install mongodb-memory-server
 * (`npm i -D mongodb-memory-server -w backend`) and set process.env.MONGO_URI
 * from `MongoMemoryServer.create()` in a beforeAll before bootE2eApp().
 */
interface HealthBody {
  status: string;
  timestamp: string;
}

interface ProvidersBody {
  success: boolean;
  data: {
    providers: { id: string; displayName: string }[];
  };
}

describe('AppModule boot (e2e)', () => {
  let e2e: E2eApp;

  beforeAll(async () => {
    e2e = await bootE2eApp();
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  it('should answer the health check', async () => {
    const response: Response = await request(e2e.httpServer).get('/health');

    expect([200, 503]).toContain(response.status);

    const body = response.body as HealthBody;
    expect(['healthy', 'unhealthy']).toContain(body.status);
    expect(typeof body.timestamp).toBe('string');
  });

  it('should list OAuth providers without a session', async () => {
    const response: Response = await request(e2e.httpServer)
      .get('/api/auth/oauth/providers')
      .expect(200);

    const body = response.body as ProvidersBody;
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data.providers)).toBe(true);
  });

  it('should return a request id header', async () => {
    const response: Response = await request(e2e.httpServer).get('/health');

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
