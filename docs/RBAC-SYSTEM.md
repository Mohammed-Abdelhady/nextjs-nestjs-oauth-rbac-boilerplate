# Dynamic RBAC System Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Permission System](#permission-system)
4. [Role Management](#role-management)
5. [Backend Implementation](#backend-implementation)
6. [Frontend Implementation](#frontend-implementation)
7. [API Reference](#api-reference)
8. [Usage Examples](#usage-examples)
9. [Security Considerations](#security-considerations)
10. [Testing](#testing)

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

### API Endpoints

**Role Management**:

```
GET    /api/roles           - List all roles
GET    /api/roles/:slug     - Get role by slug
POST   /api/roles           - Create new role
PATCH  /api/roles/:slug     - Update role
DELETE /api/roles/:slug     - Delete role
```

**Permission Management**:

```
GET    /api/admin/users/:id/permissions       - Get user permissions
PUT    /api/admin/users/:id/permissions       - Replace all permissions
POST   /api/admin/users/:id/permissions       - Add permissions
DELETE /api/admin/users/:id/permissions       - Remove permissions
```

---

## Frontend Implementation

### Permission Hooks

Use `usePermission` hook to check permissions in components:

```typescript
import { usePermission } from '@/modules/permissions';

function MyComponent() {
  const { can, canAny, canAll } = usePermission();

  if (can('users:delete:all')) {
    // User can delete users
  }

  if (canAll(['users:read:all', 'roles:read:all'])) {
    // User has BOTH permissions
  }

  if (canAny(['sessions:read:all', 'sessions:read:own'])) {
    // User has AT LEAST ONE permission
  }
}
```

### Component-Level Guards

Hide UI elements when user lacks permission:

```tsx
import { PermissionGuard, USER_PERMISSIONS } from '@/modules/permissions';

<PermissionGuard permission={USER_PERMISSIONS.DELETE_ALL}>
  <Button variant="destructive">Delete User</Button>
</PermissionGuard>;
```

**Multiple Permissions (ALL)**:

```tsx
<PermissionGuard permissions={[USER_PERMISSIONS.LIST_ALL, ROLE_PERMISSIONS.LIST_ALL]}>
  <AdminPanel />
</PermissionGuard>
```

**Any Permissions (OR)**:

```tsx
<PermissionGuard anyPermissions={[SESSION_PERMISSIONS.READ_ALL, SESSION_PERMISSIONS.READ_OWN]}>
  <SessionsList />
</PermissionGuard>
```

**With Fallback**:

```tsx
<PermissionGuard
  permission="users:delete:all"
  fallback={<p>You don't have permission to delete users.</p>}
>
  <DeleteButton />
</PermissionGuard>
```

### Route-Level Protection

Protect entire pages with `RoutePermissionGuard`:

```tsx
import { RoutePermissionGuard, ROLE_PERMISSIONS } from '@/modules/permissions';

export default function RolesPage() {
  return (
    <RoutePermissionGuard permission={ROLE_PERMISSIONS.MANAGE_ALL}>
      <RoleManagementUI />
    </RoutePermissionGuard>
  );
}
```

Users without permission are redirected to `/403` (Forbidden page).

### Navigation Guards

The `DashboardNav` component automatically shows/hides nav items based on permissions:

```tsx
const NAV_ITEMS = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
    // No permission = visible to all
  },
  {
    label: 'Users',
    href: '/admin/users',
    icon: Users,
    permission: USER_PERMISSIONS.LIST_ALL,
  },
];

// Users without permission won't see the "Users" link
```

---

## API Reference

### Role Endpoints

#### GET /api/roles

List all roles.

**Permission**: `roles:list:all`

**Response**:

```json
[
  {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Admin",
    "slug": "admin",
    "description": "System administrator",
    "permissions": ["*"],
    "isSystemRole": true,
    "isProtected": false,
    "createdAt": "2024-01-20T10:00:00Z",
    "updatedAt": "2024-01-20T10:00:00Z"
  }
]
```

#### POST /api/roles

Create a new role.

**Permission**: `roles:create:all`

**Request Body**:

```json
{
  "name": "Custom Role",
  "description": "My custom role",
  "permissions": ["users:read:all", "sessions:read:all"]
}
```

**Response**: Created role object (201)

#### PATCH /api/roles/:slug

Update role properties.

**Permission**: `roles:update:all`

**Request Body**:

```json
{
  "description": "Updated description",
  "permissions": ["users:read:all", "users:update:all"]
}
```

**Response**: Updated role object (200)

#### DELETE /api/roles/:slug

Delete a role.

**Permission**: `roles:delete:all`

**Response**: Success message (200)

**Error**: 400 if role is protected

### Permission Endpoints

#### GET /api/admin/users/:id/permissions

Get user's permissions.

**Permission**: `permissions:read:all`

**Response**:

```json
{
  "permissions": ["profile:read:own", "profile:update:own", "sessions:read:own"]
}
```

#### PUT /api/admin/users/:id/permissions

Replace all user permissions.

**Permission**: `permissions:manage:all`

**Request Body**:

```json
{
  "permissions": ["users:read:all", "roles:read:all"]
}
```

**Response**: Updated user object (200)

#### POST /api/admin/users/:id/permissions

Add permissions to user (no duplicates).

**Permission**: `permissions:grant:all`

**Request Body**:

```json
{
  "permissions": ["reports:read:all"]
}
```

**Response**: Updated user object (200)

#### DELETE /api/admin/users/:id/permissions

Remove specific permissions from user.

**Permission**: `permissions:revoke:all`

**Request Body**:

```json
{
  "permissions": ["reports:read:all"]
}
```

**Response**: Updated user object (200)

---

## Usage Examples

### Example 1: Create Custom "Moderator" Role

```typescript
// 1. Login as admin
const adminSession = await login('admin@seed.local', 'Admin123!');

// 2. Create moderator role
const moderatorRole = await fetch('/api/roles', {
  method: 'POST',
  body: JSON.stringify({
    name: 'Moderator',
    description: 'Community moderators',
    permissions: ['users:read:all', 'users:update:all', 'sessions:read:all', 'reports:read:all'],
  }),
});

// 3. Assign moderator role to user
await updateUser(userId, { role: 'moderator' });

// 4. Grant moderator permissions to user
await fetch(`/api/admin/users/${userId}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({
    permissions: ['users:read:all', 'users:update:all', 'sessions:read:all', 'reports:read:all'],
  }),
});
```

### Example 2: Temporary Permission Elevation

```typescript
// Grant temporary admin access to user
await fetch(`/api/admin/users/${userId}/permissions`, {
  method: 'POST',
  body: JSON.stringify({
    permissions: ['*'], // Wildcard
  }),
});

// Later, revoke wildcard permission
await fetch(`/api/admin/users/${userId}/permissions`, {
  method: 'DELETE',
  body: JSON.stringify({
    permissions: ['*'],
  }),
});

// Restore original permissions
await fetch(`/api/admin/users/${userId}/permissions`, {
  method: 'PUT',
  body: JSON.stringify({
    permissions: ['profile:read:own', 'profile:update:own'],
  }),
});
```

### Example 3: Permission-Based Feature Flag

```tsx
function AdvancedSettingsPanel() {
  const { can } = usePermission();

  return (
    <div>
      <h2>Settings</h2>

      {/* Basic settings - everyone can see */}
      <BasicSettings />

      {/* Advanced settings - only for power users */}
      <PermissionGuard permission="settings:advanced:access">
        <AdvancedSettings />
      </PermissionGuard>

      {/* Dangerous zone - only for admins */}
      <PermissionGuard permission="*">
        <DangerZone />
      </PermissionGuard>
    </div>
  );
}
```

---

## Security Considerations

### 1. Direct Permission Assignment

Permissions are the **source of truth**, not roles. Always check permissions, never check roles:

```typescript
// ❌ BAD - Don't check roles
if (user.role === 'admin') {
  allowAccess();
}

// ✅ GOOD - Check permissions
if (hasPermission(user.permissions, 'users:delete:all')) {
  allowAccess();
}
```

### 2. Protected Roles

The USER role is protected to prevent system breakage. Attempting to delete it returns a 400 error.

### 3. Session-Based Authentication

Sessions are stored server-side with HTTP-only cookies, preventing XSS attacks:

- Cookies are `httpOnly` (not accessible via JavaScript)
- Cookies are `secure` in production (HTTPS only)
- Sessions can be invalidated immediately on the server

### 4. Permission Validation

All permissions are validated against the allowed format (`resource:action:scope`) to prevent injection attacks.

### 5. Wildcard Permission

The `*` permission grants complete access. Only assign to trusted super administrators.

### 6. Immutable System Roles

System roles (`isSystemRole: true`) cannot have their core properties changed to prevent accidental privilege escalation.

---

## Testing

### Manual Testing

**Test Accounts** (seeded in database):

| Role    | Email                | Password      | Permissions              |
| ------- | -------------------- | ------------- | ------------------------ |
| Admin   | `admin@seed.local`   | `Admin123!`   | `*`                      |
| Manager | `manager@seed.local` | `Manager123!` | Report & user management |
| Support | `support@seed.local` | `Support123!` | Session management       |
| User    | `user@seed.local`    | `User123!`    | Own profile only         |

**Test Scenarios**:

1. **Permission Visibility**
   - Login as different users
   - Verify sidebar navigation shows correct links
   - Access `/admin/permissions-demo` as admin
   - Try accessing protected pages as regular user → should redirect to /403

2. **Role Management**
   - Create custom role as admin
   - Edit role description and permissions
   - Attempt to delete USER role → should fail
   - Delete custom role → should succeed

3. **User Permissions**
   - View user permissions on `/admin/users/permissions`
   - Add permissions to a user
   - Remove permissions from a user
   - Verify user's access changes immediately

4. **Wildcard Permission**
   - Grant `*` permission to a user
   - Verify user can access all admin features
   - Remove wildcard → verify access revoked

### Automated Testing

E2E tests are located in `backend/test/`:

- `roles.e2e-spec.ts` - Role management tests
- `permissions.e2e-spec.ts` - Permission management tests

Run tests:

```bash
cd backend
npm run test:e2e
```

---

## Migration from Old System

If upgrading from a role-based inheritance system:

1. **Run Migration Script**:

   ```bash
   cd backend
   npm run migration:up
   ```

2. **Verify Users Have Permissions**:
   - Check database: all users should have `permissions` array
   - Default permissions based on their role

3. **Update Frontend Code**:
   - Replace `RoleGuard` with `PermissionGuard`
   - Replace role checks with permission checks
   - Update navigation to use `DashboardNav`

4. **Update Backend Code**:
   - Replace `@Roles()` decorator with `@RequirePermissions()`
   - Update guards to use `PermissionGuard`

See [MIGRATION-GUIDE.md](./MIGRATION-GUIDE.md) for detailed migration steps.

---

## FAQ

**Q: Why are permissions stored on users, not roles?**
A: Maximum flexibility. Users can have custom permissions regardless of their role.

**Q: What's the purpose of roles if permissions are on users?**
A: Organizational labeling and default permission templates.

**Q: Can I change the USER role's permissions?**
A: Yes, you can update permissions, but you cannot delete or rename the role.

**Q: What happens if I give a user both `users:read:all` and `*`?**
A: Wildcard (`*`) grants all permissions, so the specific permission is redundant.

**Q: How do I revoke all permissions from a user?**
A: Use PUT `/api/admin/users/:id/permissions` with `permissions: []`.

**Q: Can regular users manage their own permissions?**
A: No, only users with `permissions:manage:all` can modify permissions.

---

## Summary

This RBAC system provides:

- ✅ Fine-grained permission control
- ✅ Flexible role management
- ✅ Secure session-based authentication
- ✅ Permission-based UI rendering
- ✅ Protected system roles
- ✅ Wildcard super admin access
- ✅ Direct user permission assignment

For implementation questions, see the codebase or contact the development team.
