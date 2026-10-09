# Dynamic RBAC System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Permission System](#permission-system)
4. [Role Management](#role-management)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](RBAC-SYSTEM-api-reference.md#frontend-implementation)
7. [API Reference](RBAC-SYSTEM-api-reference.md#api-reference)
8. [Usage Examples](RBAC-SYSTEM-api-reference.md#usage-examples)
9. [Security Considerations](RBAC-SYSTEM-security-and-testing.md#security-considerations)
10. [Testing](RBAC-SYSTEM-security-and-testing.md#testing)

---

## Overview

This application implements a comprehensive Role-Based Access Control (RBAC) system with **direct user permissions**. Unlike traditional RBAC where permissions are inherited from roles, this system assigns permissions directly to users, providing maximum flexibility.

### Key Features

- ✅ **Direct Permission Assignment**: Permissions stored on user objects, not inherited from roles
- ✅ **Dynamic Role Management**: Create, update, and delete custom roles via UI
- ✅ **Protected System Roles**: The USER role cannot be deleted to prevent system breakage
- ✅ **Wildcard Permission**: Super admin access with `*` permission
- ✅ **Permission-Based UI**: Frontend elements hidden (not disabled) based on permissions
- ✅ **Granular Access Control**: Permission format `resource:action:scope`
- ✅ **Session-Based Authentication**: HTTP-only cookies for security

---

## Architecture

### Permission Flow

```
User Login
  ↓
Session Created → User Object Loaded (with permissions array)
  ↓
Request to Protected Resource
  ↓
Permission Guard Checks User.permissions
  ↓
Grant/Deny Access
```

### Data Model

```typescript
// User Schema
{
  email: string;
  password: string;
  name: string;
  role: string;              // Reference to role (for organization)
  permissions: string[];      // Direct permissions (source of truth)
  isVerified: boolean;
}

// Role Schema
{
  name: string;
  slug: string;              // Unique identifier
  description?: string;
  permissions: string[];      // Default permissions for this role
  isSystemRole: boolean;      // Seeded during initialization
  isProtected: boolean;       // Cannot be deleted
}
```

---

## Permission System

### Permission Format

All permissions follow the format: `resource:action:scope`

**Example**: `users:read:all`

- **Resource**: `users` - What entity is being accessed
- **Action**: `read` - What operation is being performed
- **Scope**: `all` - Who/what can be accessed (all, own, team)

### Available Permissions

#### Profile Permissions

```typescript
'profile:read:own'; // Read own profile
'profile:update:own'; // Update own profile
'profile:delete:own'; // Delete own profile
```

#### User Management

```typescript
'users:read:all'; // Read any user
'users:list:all'; // List all users
'users:create:all'; // Create new users
'users:update:all'; // Update any user
'users:delete:all'; // Delete any user
'users:update:own'; // Update own user data
```

#### Role Management

```typescript
'roles:read:all'; // Read any role
'roles:list:all'; // List all roles
'roles:create:all'; // Create new roles
'roles:update:all'; // Update any role
'roles:delete:all'; // Delete roles
'roles:manage:all'; // Full role management
```

#### Permission Management

```typescript
'permissions:read:all'; // Read permissions
'permissions:grant:all'; // Grant permissions to users
'permissions:revoke:all'; // Revoke permissions from users
'permissions:manage:all'; // Full permission management
```

#### Session Management

```typescript
'sessions:read:all'; // Read all sessions
'sessions:read:own'; // Read own sessions
'sessions:delete:all'; // Delete any session
'sessions:delete:own'; // Delete own sessions
```

#### Report Permissions

```typescript
'reports:read:all'; // Read all reports
'reports:create:all'; // Create reports
```

#### Wildcard

```typescript
'*'; // Grants ALL permissions (super admin only)
```

### Default Role Permissions

**User Role** (Protected):

```typescript
[
  'profile:read:own',
  'profile:update:own',
  'profile:delete:own',
  'sessions:read:own',
  'sessions:delete:own',
];
```

**Support Role**:

```typescript
[
  'profile:read:own',
  'profile:update:own',
  'sessions:read:all',
  'sessions:delete:all',
  'users:read:all',
];
```

**Manager Role**:

```typescript
[
  'profile:read:own',
  'profile:update:own',
  'users:read:all',
  'users:list:all',
  'users:update:all',
  'reports:read:all',
  'reports:create:all',
];
```

**Admin Role**:

```typescript
['*']; // Wildcard - all permissions
```

---

## Role Management

### System Roles

System roles are created during database seeding and marked with `isSystemRole: true`:

- **USER** - Default role for new users (Protected)
- **SUPPORT** - Customer support staff
- **MANAGER** - Team managers
- **ADMIN** - System administrators

### Protected Roles

The **USER** role is protected (`isProtected: true`) and cannot be deleted. This prevents breaking the system by removing the default role.

### Custom Roles

Administrators can create custom roles with any combination of permissions. Custom roles:

- Are not system roles (`isSystemRole: false`)
- Are not protected (`isProtected: false`)
- Can be edited and deleted freely
- Can have any name and description
- Must have valid permissions

### Role vs. Permissions

**Important**: Roles are organizational labels. Permissions are directly assigned to users.

```typescript
// User has role "manager" but custom permissions
{
  role: "manager",
  permissions: ["users:read:all", "sessions:read:all"] // Not manager defaults!
}
```

---

## Backend Implementation

### Permission Guard

The `PermissionGuard` protects endpoints by checking user permissions:

```typescript
import { PermissionGuard } from '@/common/guards/permission.guard';
import { RequirePermissions } from '@/common/decorators/permissions.decorator';

@Controller('roles')
@UseGuards(AuthGuard, PermissionGuard)
export class RoleController {
  @Get()
  @RequirePermissions('roles:list:all')
  async findAll() {
    // Only accessible with roles:list:all permission
  }
}
```

### Permission Decorator

Multiple permissions can be required:

```typescript
@RequirePermissions('users:read:all', 'roles:read:all')
async getAdminDashboard() {
  // Requires BOTH permissions
}
```

### Wildcard Permission

Users with `*` permission bypass all permission checks:

```typescript
function hasPermission(userPermissions: string[], required: string): boolean {
  if (userPermissions.includes('*')) return true; // Wildcard
  return userPermissions.includes(required);
}
```

## More sections

- [API endpoints and frontend integration](RBAC-SYSTEM-api-reference.md)
- [Examples, security, and testing](RBAC-SYSTEM-security-and-testing.md)
