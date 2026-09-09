# RBAC System Migration Guide

This guide walks you through migrating from the old role-based system to the new dynamic RBAC permission system.

## Table of Contents

1. [Overview](#overview)
2. [Breaking Changes](#breaking-changes)
3. [Pre-Migration Checklist](#pre-migration-checklist)
4. [Backend Migration](#backend-migration)
5. [Frontend Migration](#frontend-migration)
6. [Database Migration](#database-migration)
7. [Testing Migration](#testing-migration)
8. [Deployment Steps](#deployment-steps)
9. [Rollback Plan](#rollback-plan)
10. [Post-Migration Verification](#post-migration-verification)

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
  cd backend && npm install
  cd frontend && npm install
  ```

### Communication

- [ ] **Notify Users**: Inform users of scheduled maintenance window
- [ ] **Team Briefing**: Brief development team on migration plan
- [ ] **Rollback Plan**: Prepare rollback procedures (see [Rollback Plan](#rollback-plan))

---

## Backend Migration

### Step 1: Update Dependencies

All required dependencies are already in `package.json`. Verify installation:

```bash
cd backend
npm install
```

### Step 2: Database Migration

Run the migration script to add permissions to existing users:

```bash
cd backend
npm run migration:up
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
npm run seed
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
npm run build

# Start production server (or use PM2/Docker)
npm run start:prod
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
npm run build
```

### Step 3: Deploy Frontend

```bash
# Development
npm run dev

# Production (with PM2 or Docker)
npm run start
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

### Manual Migration (if needed)

If automatic migration fails, manually update users:

```javascript
// Connect to MongoDB
use authboiler;

// Update admin users
db.users.updateMany(
  { role: 'admin', permissions: { $exists: false } },
  { $set: { permissions: ['*'] } }
);

// Update regular users
db.users.updateMany(
  { role: 'user', permissions: { $exists: false } },
  { $set: { permissions: [
    'profile:read:own',
    'profile:update:own',
    'profile:delete:own',
    'sessions:read:own',
    'sessions:delete:own'
  ] } }
);

// Verify migration
db.users.find({ permissions: { $exists: false } }).count(); // Should be 0
```

### Create Roles Collection

```javascript
// Insert system roles
db.roles.insertMany([
  {
    name: 'User',
    slug: 'user',
    description: 'Default user role',
    permissions: [
      'profile:read:own',
      'profile:update:own',
      'profile:delete:own',
      'sessions:read:own',
      'sessions:delete:own',
    ],
    isSystemRole: true,
    isProtected: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    name: 'Admin',
    slug: 'admin',
    description: 'System administrator',
    permissions: ['*'],
    isSystemRole: true,
    isProtected: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  // ... other roles
]);
```

---

## Testing Migration

### Test Plan

#### 1. User Login Tests

```bash
# Test each role type
for role in user support manager admin; do
  echo "Testing $role login..."
  curl -X POST http://localhost:5001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$role@seed.local\",\"password\":\"$(echo $role | sed 's/.*/\u&/')123!\"}" \
    -c "cookies-$role.txt" \
    -v
done
```

#### 2. Permission Check Tests

```bash
# Admin should access roles
curl http://localhost:5001/api/roles -b cookies-admin.txt
# Expected: 200 OK

# User should be denied
curl http://localhost:5001/api/roles -b cookies-user.txt
# Expected: 403 Forbidden
```

#### 3. Frontend Tests

Manual browser testing:

1. **Admin Account**:
   - [ ] Can see all navigation items
   - [ ] Can access `/admin/roles`
   - [ ] Can create/edit/delete custom roles
   - [ ] Cannot delete USER role (protected)
   - [ ] Can manage user permissions

2. **Regular User Account**:
   - [ ] Only sees Dashboard and Settings in nav
   - [ ] Cannot access `/admin/roles` (redirects to /403)
   - [ ] Can view own profile
   - [ ] Cannot see "Manage Permissions" button

3. **Manager Account**:
   - [ ] Sees Dashboard, Settings, Users, Reports
   - [ ] Can access `/admin/users`
   - [ ] Cannot access `/admin/roles` (no permission)

---

## Deployment Steps

### Production Deployment

#### Option 1: Zero-Downtime Deployment (Blue-Green)

1. **Deploy New Version (Green)**:

   ```bash
   # Build new version
   cd backend && npm run build
   cd frontend && npm run build

   # Start on different ports
   PORT=5002 npm run start:prod  # Backend
   PORT=3002 npm run start       # Frontend
   ```

2. **Run Migrations**:

   ```bash
   cd backend
   npm run migration:up
   npm run seed
   ```

3. **Test Green Environment**:
   - Verify all endpoints work
   - Test login and permissions
   - Check UI navigation

4. **Switch Traffic**:

   ```bash
   # Update load balancer/proxy to point to new ports
   # Or restart services on original ports
   ```

5. **Monitor**:
   - Watch error logs
   - Monitor response times
   - Check user sessions

#### Option 2: Maintenance Window Deployment

1. **Enable Maintenance Mode**:

   ```bash
   # Display maintenance page to users
   ```

2. **Stop Services**:

   ```bash
   pm2 stop backend
   pm2 stop frontend
   ```

3. **Backup Database**:

   ```bash
   mongodump --out=/backups/$(date +%Y%m%d-%H%M%S)
   ```

4. **Deploy Code**:

   ```bash
   git pull origin main
   cd backend && npm install && npm run build
   cd frontend && npm install && npm run build
   ```

5. **Run Migrations**:

   ```bash
   cd backend
   npm run migration:up
   npm run seed
   ```

6. **Start Services**:

   ```bash
   pm2 restart backend
   pm2 restart frontend
   ```

7. **Disable Maintenance Mode**:
   ```bash
   # Remove maintenance page
   ```

---

## Rollback Plan

### Quick Rollback (Code Only)

If the new code has issues but database is fine:

```bash
# Revert to previous version
git checkout v1.0.0-pre-rbac

# Rebuild
cd backend && npm install && npm run build
cd frontend && npm install && npm run build

# Restart services
pm2 restart all
```

### Full Rollback (Code + Database)

If database migration caused issues:

```bash
# 1. Stop services
pm2 stop all

# 2. Restore database from backup
mongorestore --drop /backups/pre-rbac-migration

# 3. Revert code
git checkout v1.0.0-pre-rbac
cd backend && npm install && npm run build
cd frontend && npm install && npm run build

# 4. Restart services
pm2 restart all
```

### Partial Rollback (Keep Permissions, Revert UI)

If you want to keep the new permission system but revert frontend:

```bash
# Frontend only
cd frontend
git checkout v1.0.0-pre-rbac -- src/
npm run build
pm2 restart frontend
```

---

## Post-Migration Verification

### Automated Checks

Run the E2E test suite:

```bash
cd backend
npm run test:e2e
```

### Manual Verification

#### 1. User Management

- [ ] Admin can view all users
- [ ] Admin can update user permissions
- [ ] Permission changes take effect immediately
- [ ] Regular users cannot access admin endpoints

#### 2. Role Management

- [ ] Admin can create custom roles
- [ ] Admin can edit role permissions
- [ ] USER role cannot be deleted
- [ ] Custom roles can be deleted

#### 3. Authentication

- [ ] Login works for all user types
- [ ] Session persists across requests
- [ ] Logout clears session properly
- [ ] Password reset still works

#### 4. UI/UX

- [ ] Navigation items show/hide based on permissions
- [ ] Protected pages redirect to /403
- [ ] Permission demo page works
- [ ] No console errors

#### 5. Performance

- [ ] Page load times acceptable
- [ ] API response times normal
- [ ] No N+1 query issues
- [ ] Database queries optimized

### Monitoring

Set up monitoring for:

```bash
# Error rate
# Response time
# Session creation rate
# Failed permission checks
# Database connection pool
```

---

## Common Issues

### Issue 1: Users Missing Permissions

**Symptom**: Users cannot access anything after migration

**Solution**:

```bash
# Re-run migrations
cd backend && npm run migration:up

# Or manually assign default permissions
```

### Issue 2: Role Field Type Error

**Symptom**: TypeScript errors about role type mismatch

**Solution**: Ensure all DTOs updated to use `string` instead of `UserRole` enum

### Issue 3: Session Not Persisting

**Symptom**: Users logged out after each request

**Solution**: Check cookie settings in auth controller, ensure `httpOnly` and `sameSite` configured

### Issue 4: Frontend Shows Wrong Navigation

**Symptom**: Nav items don't match user permissions

**Solution**: Clear browser cache, verify Redux state includes permissions

---

## Best Practices

### Do's

- ✅ Test migration on staging first
- ✅ Create database backup before migration
- ✅ Run migrations during low-traffic hours
- ✅ Monitor error logs during and after deployment
- ✅ Keep rollback plan ready
- ✅ Communicate with users about maintenance

### Don'ts

- ❌ Don't skip database backup
- ❌ Don't deploy during peak hours
- ❌ Don't assume migration is idempotent without testing
- ❌ Don't forget to update API documentation
- ❌ Don't ignore TypeScript errors
- ❌ Don't rush verification steps

---

## Support

### Troubleshooting

1. Check logs: `pm2 logs`
2. Verify database connection: `mongo --eval "db.stats()"`
3. Test authentication: Use curl commands from this guide
4. Check environment variables: `printenv | grep -i mongo`

### Contact

For migration issues:

- Create GitHub issue with migration logs
- Contact development team
- Review [RBAC-SYSTEM.md](./RBAC-SYSTEM.md) documentation

---

## Summary

This migration guide covers:

- ✅ Complete migration process
- ✅ Rollback procedures
- ✅ Testing checklist
- ✅ Common issues and solutions
- ✅ Post-migration verification

Estimated total migration time: **1-2 hours** including testing.

Follow this guide step-by-step to ensure smooth migration to the new RBAC system.
