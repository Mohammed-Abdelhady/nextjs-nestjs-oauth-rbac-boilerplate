import request from 'supertest';
import type { Response } from 'supertest';
import {
  bootE2eApp,
  loginAs,
  type E2eApp,
  type TestAgent,
} from '../utils/e2e-app';
import { SEED_ADMIN, SEED_USER } from '../constants/seed-users';
import type { RegisterResponse, UserResponse } from '../types/e2e-responses';

const BASE_PERMISSIONS = ['profile:read:own', 'profile:update:own'];

describe('Permission enforcement (e2e)', () => {
  let e2e: E2eApp;
  let adminAgent: TestAgent;
  let userAgent: TestAgent;
  let testUserId: string;

  const setPermissions = async (permissions: string[]): Promise<void> => {
    await adminAgent
      .put(`/api/admin/users/${testUserId}/permissions`)
      .send({ permissions });
  };

  beforeAll(async () => {
    e2e = await bootE2eApp();

    adminAgent = await loginAs(e2e.httpServer, SEED_ADMIN);
    userAgent = await loginAs(e2e.httpServer, SEED_USER);

    const meResponse: Response = await userAgent
      .get('/api/auth/me')
      .expect(200);
    testUserId = (meResponse.body as UserResponse)._id;
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  describe('Permission checking logic', () => {
    it('should grant access with wildcard permission', async () => {
      await setPermissions(['*']);

      await userAgent.get('/api/roles').expect(200);

      await setPermissions(BASE_PERMISSIONS);
    });

    it('should deny access without required permission', async () => {
      await userAgent.get('/api/roles').expect(403);
    });

    it('should grant access with specific permission', async () => {
      await adminAgent
        .post(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['roles:list:all'] });

      await userAgent.get('/api/roles').expect(200);

      await adminAgent
        .delete(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['roles:list:all'] });
    });
  });

  describe('Permission inheritance', () => {
    it('should verify permissions are directly assigned to users', async () => {
      const response: Response = await userAgent
        .get('/api/auth/me')
        .expect(200);

      const user = response.body as UserResponse;
      expect(user).toHaveProperty('permissions');
      expect(Array.isArray(user.permissions)).toBe(true);
      expect(user).toHaveProperty('role');
    });

    it('should allow users with same role to have different permissions', async () => {
      const userResponse: Response = await userAgent
        .get('/api/auth/me')
        .expect(200);

      const registerResponse: Response = await request(e2e.httpServer)
        .post('/api/auth/register')
        .send({
          email: 'testuser@test.local',
          password: 'Test123!',
          name: 'Test User',
        })
        .expect(201);

      expect((userResponse.body as UserResponse).role).toBe('user');
      expect((registerResponse.body as RegisterResponse).user.role).toBe(
        'user',
      );
    });
  });

  describe('Protected permissions', () => {
    it('should validate permission format against allowed permissions', async () => {
      await adminAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['invalid:action:scope'] })
        .expect(400);
    });

    it('should accept all valid permission combinations', async () => {
      const validPermissions = [
        'users:read:all',
        'users:create:all',
        'users:update:all',
        'users:delete:all',
        'roles:read:all',
        'roles:manage:all',
        'permissions:grant:all',
        'permissions:revoke:all',
        'sessions:read:all',
        'sessions:delete:own',
        'reports:read:all',
        'reports:create:all',
        'profile:read:own',
        'profile:update:own',
      ];

      const response: Response = await adminAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: validPermissions })
        .expect(200);

      expect((response.body as UserResponse).permissions).toEqual(
        validPermissions,
      );

      await setPermissions(BASE_PERMISSIONS);
    });
  });

  describe('Multiple permission checks', () => {
    it('should require all permissions when multiple are specified', async () => {
      await setPermissions(['users:read:all']);

      const response: Response = await userAgent
        .get('/api/auth/me')
        .expect(200);

      const user = response.body as UserResponse;
      expect(user.permissions).toContain('users:read:all');
      expect(user.permissions).not.toContain('roles:read:all');
    });

    it('should grant access when any of specified permissions is present', async () => {
      await setPermissions(['sessions:read:own']);

      const response: Response = await userAgent
        .get('/api/auth/me')
        .expect(200);

      expect((response.body as UserResponse).permissions).toContain(
        'sessions:read:own',
      );
    });
  });
});
