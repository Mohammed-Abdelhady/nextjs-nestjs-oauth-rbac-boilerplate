import type { Response } from 'supertest';
import {
  bootE2eApp,
  loginAs,
  type E2eApp,
  type TestAgent,
} from '../utils/e2e-app';
import { SEED_ADMIN, SEED_MANAGER, SEED_USER } from '../constants/seed-users';
import type { PermissionsResponse, UserResponse } from '../types/e2e-responses';

const BASE_PERMISSIONS = ['profile:read:own', 'profile:update:own'];

describe('Admin permission routes (e2e)', () => {
  let e2e: E2eApp;
  let adminAgent: TestAgent;
  let managerAgent: TestAgent;
  let userAgent: TestAgent;
  let testUserId: string;

  const restoreBasePermissions = async (): Promise<void> => {
    await adminAgent
      .put(`/api/admin/users/${testUserId}/permissions`)
      .send({ permissions: BASE_PERMISSIONS });
  };

  beforeAll(async () => {
    e2e = await bootE2eApp();

    adminAgent = await loginAs(e2e.httpServer, SEED_ADMIN);
    managerAgent = await loginAs(e2e.httpServer, SEED_MANAGER);
    userAgent = await loginAs(e2e.httpServer, SEED_USER);

    const meResponse: Response = await userAgent
      .get('/api/auth/me')
      .expect(200);
    testUserId = (meResponse.body as UserResponse)._id;
  });

  afterAll(async () => {
    await e2e.app.close();
  });

  describe('GET /api/admin/users/:id/permissions', () => {
    it('should return user permissions for admin', async () => {
      const response: Response = await adminAgent
        .get(`/api/admin/users/${testUserId}/permissions`)
        .expect(200);

      const body = response.body as PermissionsResponse;
      expect(body).toHaveProperty('permissions');
      expect(Array.isArray(body.permissions)).toBe(true);
    });

    it('should deny access for regular user', async () => {
      await userAgent
        .get(`/api/admin/users/${testUserId}/permissions`)
        .expect(403);
    });

    it('should return 404 for non-existent user', async () => {
      await adminAgent
        .get('/api/admin/users/507f1f77bcf86cd799439011/permissions')
        .expect(404);
    });
  });

  describe('PUT /api/admin/users/:id/permissions', () => {
    it('should update user permissions for admin', async () => {
      const newPermissions = [
        'profile:read:own',
        'profile:update:own',
        'sessions:read:own',
      ];

      const response: Response = await adminAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: newPermissions })
        .expect(200);

      const body = response.body as PermissionsResponse;
      expect(body.permissions).toEqual(newPermissions);
    });

    it('should allow adding wildcard permission', async () => {
      const response: Response = await adminAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['*'] })
        .expect(200);

      const body = response.body as PermissionsResponse;
      expect(body.permissions).toContain('*');

      await restoreBasePermissions();
    });

    it('should validate permission format', async () => {
      await adminAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['invalid-format'] })
        .expect(400);
    });

    it('should allow empty permissions array', async () => {
      const response: Response = await adminAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: [] })
        .expect(200);

      const body = response.body as PermissionsResponse;
      expect(body.permissions).toEqual([]);

      await restoreBasePermissions();
    });

    it('should deny access for regular user', async () => {
      await userAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['users:read:all'] })
        .expect(403);
    });

    it('should deny access for manager without permission management rights', async () => {
      await managerAgent
        .put(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['users:read:all'] })
        .expect(403);
    });
  });

  describe('POST /api/admin/users/:id/permissions', () => {
    it('should add permissions to user', async () => {
      const response: Response = await adminAgent
        .post(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['reports:read:all'] })
        .expect(200);

      const body = response.body as PermissionsResponse;
      expect(body.permissions).toContain('reports:read:all');
    });

    it('should not duplicate existing permissions', async () => {
      const response: Response = await adminAgent
        .post(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['profile:read:own'] })
        .expect(200);

      const body = response.body as PermissionsResponse;
      const count = body.permissions.filter(
        (permission) => permission === 'profile:read:own',
      ).length;
      expect(count).toBe(1);
    });

    it('should deny access for regular user', async () => {
      await userAgent
        .post(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['users:read:all'] })
        .expect(403);
    });
  });

  describe('DELETE /api/admin/users/:id/permissions', () => {
    it('should remove specific permissions from user', async () => {
      const response: Response = await adminAgent
        .delete(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['reports:read:all'] })
        .expect(200);

      const body = response.body as PermissionsResponse;
      expect(body.permissions).not.toContain('reports:read:all');
    });

    it('should handle removing non-existent permissions gracefully', async () => {
      const response: Response = await adminAgent
        .delete(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['nonexistent:permission'] })
        .expect(200);

      expect(response.body).toHaveProperty('permissions');
    });

    it('should deny access for regular user', async () => {
      await userAgent
        .delete(`/api/admin/users/${testUserId}/permissions`)
        .send({ permissions: ['profile:read:own'] })
        .expect(403);
    });
  });
});
