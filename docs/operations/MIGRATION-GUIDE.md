# RBAC System Migration Guide

This guide walks you through migrating from the old role-based system to the new dynamic RBAC permission system.

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Backend Migration](#backend-migration)
5. [Frontend Migration](#frontend-migration)
6. [Database Migration](#database-migration)
7. [Testing Migration](MIGRATION-GUIDE-manual-migration.md#testing-migration)
8. [Deployment Steps](MIGRATION-GUIDE-manual-migration.md#deployment-steps)
9. [Rollback Plan](MIGRATION-GUIDE-manual-migration.md#rollback-plan)
10. [Post-Migration Verification](MIGRATION-GUIDE-manual-migration.md#post-migration-verification)

---

## Overview

### What Changed

**Before** (Role-Based):

- Fixed enum roles: `USER`, `ADMIN`, `MANAGER`, `SUPPORT`
- Permissions inherited from roles
- Role checks in code: `if (user.role === 'admin')`

**After** (Permission-Based):

- Dynamic role system with custom roles
- Permissions directly assigned to users
- Permission checks: `if (hasPermission(user.permissions, 'users:delete:all'))`

### Migration Timeline

- **Preparation**: 30 minutes
- **Database Migration**: 5-10 minutes
- **Code Deployment**: 15 minutes
- **Verification**: 30 minutes
- **Total Estimated Time**: ~1.5 hours

---

## Breaking Changes

### 1. User Schema Change

**Before**:

```typescript
{
  role: UserRole; // Enum type
}
```

**After**:

```typescript
{
  role: string;           // String type
  permissions: string[];  // New field
}
```

### 2. Authentication Response

**Before**:

```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "admin"
  }
}
```

**After**:

```json
{
  "user": {
    "id": "123",
    "email": "user@example.com",
    "role": "admin",
    "permissions": ["*"] // NEW
  }
}
```

### 3. Guard Changes

**Before** (Backend):

```typescript
@UseGuards(AuthGuard, RolesGuard)
@Roles('admin', 'manager')
async getUsers() {}
```

**After** (Backend):

```typescript
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('users:list:all')
async getUsers() {}
```

**Before** (Frontend):

```tsx
<RoleGuard allowedRoles={['admin']}>
  <AdminPanel />
</RoleGuard>
```

**After** (Frontend):

```tsx
<RoutePermissionGuard permission={USER_PERMISSIONS.LIST_ALL}>
  <AdminPanel />
</RoutePermissionGuard>
```

---

## Pre-Migration Checklist

### Backup

- [ ] **Database Backup**: Create full backup of production database

  ```bash
  mongodump --uri="mongodb://localhost:27017/authboiler" --out=/backups/pre-rbac-migration
  ```

- [ ] **Code Backup**: Tag current production version
  ```bash
  git tag -a v1.0.0-pre-rbac -m "Before RBAC migration"
  git push origin v1.0.0-pre-rbac
  ```

### Environment Preparation

- [ ] **Test Environment**: Set up staging environment matching production
- [ ] **Dependencies**: Ensure all new dependencies are installed
  ```bash
  cd backend && pnpm install --frozen-lockfile
  cd frontend && pnpm install --frozen-lockfile
  ```

### Communication

- [ ] **Notify Users**: Inform users of scheduled maintenance window
- [ ] **Team Briefing**: Brief development team on migration plan
  - [ ] **Rollback Plan**: Prepare rollback procedures (see [Rollback Plan](MIGRATION-GUIDE-manual-migration.md#rollback-plan))

---

## Backend Migration

### Step 1: Update Dependencies

All required dependencies are already in `package.json`. Verify installation:

```bash
cd backend
pnpm install --frozen-lockfile
```

### Step 2: Database Migration

Run the migration script to add permissions to existing users:

```bash
cd backend
pnpm run migration:up
```

**What this does**:

- Finds all users without permissions
- Assigns default permissions based on their current role
- Preserves existing role assignments

**Expected Output**:

```
✅ Migration: add-permissions-to-users
   Users migrated: 150
   Duration: 2.3s
   Status: SUCCESS
```

### Step 3: Seed Roles

Run database seeding to create system roles:

```bash
pnpm --filter backend run seed
```

**What this does**:

- Creates 4 system roles: USER, SUPPORT, MANAGER, ADMIN
- Marks USER role as protected
- Sets default permissions for each role

### Step 4: Update Environment Variables

No new environment variables required. Existing `.env` file works with new system.

### Step 5: Deploy Backend Code

```bash
# Build production code
pnpm run build

# Start the production server
pnpm run start:prod
```

### Step 6: Verify Backend

Test critical endpoints:

```bash
# Health check
curl http://localhost:5001/health

# Login test
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@seed.local","password":"Admin123!"}' \
  -c cookies.txt

# Check roles endpoint
curl http://localhost:5001/api/roles \
  -b cookies.txt
```

---

## Frontend Migration

### Step 1: Update Code

All frontend migration code is already in place. No manual changes needed.

### Step 2: Build Frontend

```bash
cd frontend
pnpm run build
```

### Step 3: Deploy Frontend

```bash
# Development
pnpm run dev

# Production
pnpm run start
```

### Step 4: Verify Frontend

1. Open browser to frontend URL
2. Login with test account
3. Verify navigation shows correct items
4. Check `/admin/roles` page loads
5. Check `/admin/permissions-demo` page loads

---

## Database Migration

### Migration Script Details

**File**: `backend/src/database/migrations/add-permissions-to-users.migration.ts`

**What it does**:

1. Finds users missing `permissions` field
2. Assigns default permissions based on role:
   - `user` → profile and session permissions
   - `support` → session management permissions
   - `manager` → user and report permissions
   - `admin` → wildcard permission (`*`)

**Idempotency**: Safe to run multiple times. Skips users who already have permissions.

## More sections

- [Manual migration, deployment, and rollback](MIGRATION-GUIDE-manual-migration.md)
- [Migration verification and troubleshooting](MIGRATION-GUIDE-verification.md)
