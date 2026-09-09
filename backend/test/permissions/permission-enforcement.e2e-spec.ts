import type { ApiBody } from '../types/e2e-responses';
import { getModelToken } from '@nestjs/mongoose';
import type { Model } from 'mongoose';
import type { UserDocument } from '../../src/user/schemas/user.schema';
import { replacePermissions } from '../utils/permissions';
import request from 'supertest';
import type { Response } from 'supertest';
import {
  bootE2eApp,
  loginAs,
  type E2eApp,
  type TestAgent,
} from '../utils/e2e-app';
import { SEED_ADMIN, SEED_USER } from '../constants/seed-users';
import type { UserResponse } from '../types/e2e-responses';

const BASE_PERMISSIONS = ['profile:read:own', 'profile:update:own'];

describe('Permission enforcement (e2e)', () => {
  let e2e: E2eApp;
  let adminAgent: TestAgent;
  let userAgent: TestAgent;
  let testUserId: string;

  const setPermissions = async (permissions: string[]): Promise<void> => {
    await replacePermissions(adminAgent, testUserId, permissions);
  };

  beforeAll(async () => {
    e2e = await bootE2eApp();

    adminAgent = await loginAs(e2e.httpServer, SEED_ADMIN);
    userAgent = await loginAs(e2e.httpServer, SEED_USER);

    const meResponse: Response = await userAgent
      .get('/api/user/profile')
      .expect(200);
    testUserId = (meResponse.body as ApiBody<UserResponse>).data.id;
  });

  afterAll(async () => {
    await e2e?.close();
  });

  describe('Permission checking logic', () => {
    it('should grant access with wildcard permission', async () => {
      await e2e.app
        .get<Model<UserDocument>>(getModelToken('User'))
        .updateOne({ _id: testUserId }, { permissions: ['*'] });

      await userAgent.get('/api/roles').expect(200);

      await setPermissions(BASE_PERMISSIONS);
    });

    it('should deny access without required permission', async () => {
      await userAgent.get('/api/roles').expect(403);
    });

    it('should grant access with specific permission', async () => {
      await adminAgent
        .post(`/api/admin/users/${testUserId}/permissions`)
        .send({ permission: 'roles:list:all' });

      await userAgent.get('/api/roles').expect(200);

      await adminAgent.delete(
        `/api/admin/users/${testUserId}/permissions/roles%3Alist%3Aall`,
      );
    });
  });

  describe('Permission inheritance', () => {
    it('should verify permissions are directly assigned to users', async () => {
      const response: Response = await userAgent
        .get('/api/user/profile')
        .expect(200);

      const user = (response.body as ApiBody<UserResponse>).data;
      expect(user).toHaveProperty('permissions');
      expect(Array.isArray(user.permissions)).toBe(true);
      expect(user).toHaveProperty('role');
    });

    it('should allow users with same role to have different permissions', async () => {
      const userResponse: Response = await userAgent
        .get('/api/user/profile')
        .expect(200);

      const registerResponse: Response = await request(e2e.httpServer)
        .post('/api/auth/register')
        .send({
          email: 'testuser@test.local',
          password: 'Test1234!',
          name: 'Test User',
        })
        .expect(200);

      expect((userResponse.body as ApiBody<UserResponse>).data.role).toBe(
        'user',
      );
      expect(registerResponse.body).toHaveProperty('success', true);
      const message = e2e.mail.at(-1);
      const code = message?.text?.match(/\b\d{6}\b/)?.[0];
      expect(code).toBeDefined();
      const activated = request.agent(e2e.httpServer);
      await activated
        .post('/api/auth/activate')
        .send({ email: 'testuser@test.local', code })
        .expect(200);
      const profile = await activated.get('/api/user/profile').expect(200);
      expect((profile.body as ApiBody<UserResponse>).data.role).toBe('user');
      expect(e2e.mail).toHaveLength(1);
    });
  });

  describe('Protected permissions', () => {
    it('should validate permission format against allowed permissions', async () => {
      await adminAgent
        .post(`/api/admin/users/${testUserId}/permissions`)
        .send({ permission: 'invalid permission' })
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

      const response = await replacePermissions(
        adminAgent,
        testUserId,
        validPermissions,
      );

      expect(
        [...(response.body as ApiBody<UserResponse>).data.permissions].sort(),
      ).toEqual([...validPermissions].sort());

      await setPermissions(BASE_PERMISSIONS);
    });
  });

  describe('Multiple permission checks', () => {
    it('should require all permissions when multiple are specified', async () => {
      await setPermissions(['users:read:all']);

      const response: Response = await userAgent
        .get('/api/user/profile')
        .expect(200);

      const user = (response.body as ApiBody<UserResponse>).data;
      expect(user.permissions).toContain('users:read:all');
      expect(user.permissions).not.toContain('roles:read:all');
    });

    it('should grant access when any of specified permissions is present', async () => {
      await setPermissions(['sessions:read:own']);

      const response: Response = await userAgent
        .get('/api/user/profile')
        .expect(200);

      expect(
        (response.body as ApiBody<UserResponse>).data.permissions,
      ).toContain('sessions:read:own');
    });
  });
});
