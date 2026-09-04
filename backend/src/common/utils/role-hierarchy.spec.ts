import { UserRole } from '../../user/enums/user-role.enum';
import {
  hasMinimumRole,
  canManageLevel,
  canModifyLevel,
  isValidRoleAssignment,
  ADMIN_LEVEL,
  CUSTOM_ROLE_LEVEL,
  ROLE_HIERARCHY,
  UNKNOWN_ROLE_LEVEL,
} from './role-hierarchy';

describe('Role Hierarchy Utilities', () => {
  describe('ROLE_HIERARCHY', () => {
    it('should have correct hierarchy values', () => {
      expect(ROLE_HIERARCHY[UserRole.USER]).toBe(1);
      expect(ROLE_HIERARCHY[UserRole.SUPPORT]).toBe(2);
      expect(ROLE_HIERARCHY[UserRole.MANAGER]).toBe(3);
      expect(ROLE_HIERARCHY[UserRole.ADMIN]).toBe(4);
    });

    it('should place custom roles at the default level', () => {
      expect(CUSTOM_ROLE_LEVEL).toBe(ROLE_HIERARCHY[UserRole.USER]);
      expect(ADMIN_LEVEL).toBe(ROLE_HIERARCHY[UserRole.ADMIN]);
    });
  });

  describe('hasMinimumRole', () => {
    it('should return true when user role is higher than required', () => {
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.USER)).toBe(true);
      expect(hasMinimumRole(UserRole.MANAGER, UserRole.SUPPORT)).toBe(true);
    });

    it('should return true when user role equals required', () => {
      expect(hasMinimumRole(UserRole.ADMIN, UserRole.ADMIN)).toBe(true);
      expect(hasMinimumRole(UserRole.USER, UserRole.USER)).toBe(true);
    });

    it('should return false when user role is lower than required', () => {
      expect(hasMinimumRole(UserRole.USER, UserRole.ADMIN)).toBe(false);
      expect(hasMinimumRole(UserRole.SUPPORT, UserRole.MANAGER)).toBe(false);
    });
  });

  describe('canManageLevel (non-strict, reads)', () => {
    it('should allow a higher level to reach a lower one', () => {
      expect(canManageLevel(ADMIN_LEVEL, CUSTOM_ROLE_LEVEL)).toBe(true);
    });

    it('should allow peers to see each other', () => {
      expect(canManageLevel(3, 3)).toBe(true);
    });

    it('should refuse a lower level', () => {
      expect(canManageLevel(2, 3)).toBe(false);
    });

    it('should reserve stranded roles for admins', () => {
      expect(canManageLevel(3, UNKNOWN_ROLE_LEVEL)).toBe(false);
      expect(canManageLevel(ADMIN_LEVEL, UNKNOWN_ROLE_LEVEL)).toBe(true);
    });
  });

  describe('canModifyLevel (strict, mutations)', () => {
    it('should allow a higher level to act on a lower one', () => {
      expect(canModifyLevel(ADMIN_LEVEL, 3)).toBe(true);
      expect(canModifyLevel(3, CUSTOM_ROLE_LEVEL)).toBe(true);
    });

    it('should refuse peers', () => {
      expect(canModifyLevel(3, 3)).toBe(false);
      expect(canModifyLevel(ADMIN_LEVEL, ADMIN_LEVEL)).toBe(false);
    });

    it('should refuse a lower level', () => {
      expect(canModifyLevel(1, 4)).toBe(false);
    });

    it('should reserve stranded roles for admins', () => {
      expect(canModifyLevel(3, UNKNOWN_ROLE_LEVEL)).toBe(false);
      expect(canModifyLevel(ADMIN_LEVEL, UNKNOWN_ROLE_LEVEL)).toBe(true);
    });
  });

  describe('isValidRoleAssignment', () => {
    it('should return true for non-ADMIN roles', () => {
      expect(isValidRoleAssignment(UserRole.USER)).toBe(true);
      expect(isValidRoleAssignment(UserRole.SUPPORT)).toBe(true);
      expect(isValidRoleAssignment(UserRole.MANAGER)).toBe(true);
      expect(isValidRoleAssignment('content-editor')).toBe(true);
    });

    it('should return false for ADMIN role', () => {
      expect(isValidRoleAssignment(UserRole.ADMIN)).toBe(false);
    });
  });
});
