import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { ForbiddenException } from '@nestjs/common';
import { RoleService } from './role.service';
import { Role } from './schemas/role.schema';
import { User } from '../user/schemas/user.schema';

interface MockRole {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  isSystemRole: boolean;
  isProtected: boolean;
  level?: number;
  permissions: string[];
  createdAt: Date;
  updatedAt: Date;
  save: jest.Mock;
}

function buildRole(overrides: Partial<MockRole> = {}): MockRole {
  return {
    _id: new Types.ObjectId(),
    name: 'Content Editor',
    slug: 'content-editor',
    isSystemRole: false,
    isProtected: false,
    level: 1,
    permissions: ['posts:read:all'],
    createdAt: new Date(),
    updatedAt: new Date(),
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

describe('RoleService', () => {
  let service: RoleService;

  const mockRoleModel = {
    findOne: jest.fn(),
    findById: jest.fn(),
    deleteOne: jest.fn().mockResolvedValue({ deletedCount: 1 }),
  };

  const mockUserModel = {
    countDocuments: jest.fn().mockResolvedValue(0),
    updateMany: jest.fn().mockResolvedValue({ modifiedCount: 0 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoleService,
        { provide: getModelToken(Role.name), useValue: mockRoleModel },
        { provide: getModelToken(User.name), useValue: mockUserModel },
      ],
    }).compile();

    service = module.get<RoleService>(RoleService);
    jest.clearAllMocks();
    mockUserModel.countDocuments.mockResolvedValue(0);
    mockUserModel.updateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  describe('update (S-15 system role immutability)', () => {
    it('should refuse a rename that would change a system role slug', async () => {
      const admin = buildRole({
        name: 'Admin',
        slug: 'admin',
        isSystemRole: true,
        isProtected: true,
        level: 4,
        permissions: ['*'],
      });
      mockRoleModel.findOne.mockResolvedValueOnce(admin);

      await expect(
        service.update('admin', { name: 'Super Admin' }),
      ).rejects.toThrow(ForbiddenException);
      expect(admin.save).not.toHaveBeenCalled();
    });

    it('should accept a rename that leaves the system role slug alone', async () => {
      const support = buildRole({
        name: 'Support',
        slug: 'support',
        isSystemRole: true,
        isProtected: true,
        level: 2,
        permissions: ['users:read:all'],
      });
      mockRoleModel.findOne.mockResolvedValueOnce(support);
      mockRoleModel.findOne.mockResolvedValueOnce(null);

      const result = await service.update('support', { name: 'SUPPORT' });

      expect(result.slug).toBe('support');
      expect(result.usersMoved).toBe(0);
      expect(support.save).toHaveBeenCalled();
      expect(mockUserModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('update (S-15 admin wildcard)', () => {
    it('should refuse dropping the wildcard from the admin role', async () => {
      const admin = buildRole({
        name: 'Admin',
        slug: 'admin',
        isSystemRole: true,
        isProtected: true,
        level: 4,
        permissions: ['*'],
      });
      mockRoleModel.findOne.mockResolvedValueOnce(admin);

      await expect(
        service.update('admin', { permissions: ['users:read:all'] }),
      ).rejects.toThrow(ForbiddenException);
      expect(admin.save).not.toHaveBeenCalled();
    });

    it('should accept admin permissions that keep the wildcard', async () => {
      const admin = buildRole({
        name: 'Admin',
        slug: 'admin',
        isSystemRole: true,
        isProtected: true,
        level: 4,
        permissions: ['*'],
      });
      mockRoleModel.findOne.mockResolvedValueOnce(admin);

      const result = await service.update('admin', {
        permissions: ['*', 'reports:read:all'],
      });

      expect(result.permissions).toEqual(['*', 'reports:read:all']);
      expect(admin.save).toHaveBeenCalled();
    });
  });

  describe('update (D-01 rename cascade)', () => {
    it('should move users onto the new slug and report the count', async () => {
      const role = buildRole();
      mockRoleModel.findOne.mockResolvedValueOnce(role);
      mockRoleModel.findOne.mockResolvedValueOnce(null);
      mockUserModel.updateMany.mockResolvedValueOnce({ modifiedCount: 3 });

      const result = await service.update('content-editor', {
        name: 'Content Lead',
      });

      expect(result.slug).toBe('content-lead');
      expect(result.usersMoved).toBe(3);
      expect(mockUserModel.updateMany).toHaveBeenCalledWith(
        { role: 'content-editor' },
        { $set: { role: 'content-lead' } },
      );
    });

    it('should leave users alone when the slug does not change', async () => {
      const role = buildRole();
      mockRoleModel.findOne.mockResolvedValueOnce(role);

      const result = await service.update('content-editor', {
        description: 'Writes and edits posts',
      });

      expect(result.usersMoved).toBe(0);
      expect(mockUserModel.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should refuse to delete a system role', async () => {
      mockRoleModel.findOne.mockResolvedValueOnce(
        buildRole({
          name: 'Manager',
          slug: 'manager',
          isSystemRole: true,
          isProtected: true,
          level: 3,
        }),
      );

      await expect(service.delete('manager')).rejects.toThrow(
        ForbiddenException,
      );
      expect(mockRoleModel.deleteOne).not.toHaveBeenCalled();
    });

    it('should refuse to delete a protected role', async () => {
      mockRoleModel.findOne.mockResolvedValueOnce(
        buildRole({ isProtected: true }),
      );

      await expect(service.delete('content-editor')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should delete an unused custom role', async () => {
      const role = buildRole();
      mockRoleModel.findOne.mockResolvedValueOnce(role);

      await service.delete('content-editor');

      expect(mockRoleModel.deleteOne).toHaveBeenCalledWith({ _id: role._id });
    });
  });
});
