# Manual migration, deployment, and rollback

[Guide overview](MIGRATION-GUIDE.md)

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
   cd backend && pnpm run build
   cd frontend && pnpm run build

   # Start on different ports
   PORT=5002 pnpm --filter backend run start:prod  # Backend
   PORT=3002 pnpm --filter frontend run start      # Frontend
   ```

2. **Run Migrations**:

   ```bash
   cd backend
   pnpm run migration:up
   pnpm run seed
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
   cd backend && pnpm install --frozen-lockfile && pnpm run build
   cd frontend && pnpm install --frozen-lockfile && pnpm run build
   ```

5. **Run Migrations**:

   ```bash
   cd backend
   pnpm run migration:up
   pnpm run seed
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
cd backend && pnpm install --frozen-lockfile && pnpm run build
cd frontend && pnpm install --frozen-lockfile && pnpm run build

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
cd backend && pnpm install --frozen-lockfile && pnpm run build
cd frontend && pnpm install --frozen-lockfile && pnpm run build

# 4. Restart services
pm2 restart all
```

### Partial Rollback (Keep Permissions, Revert UI)

If you want to keep the new permission system but revert frontend:

```bash
# Frontend only
cd frontend
git checkout v1.0.0-pre-rbac -- src/
pnpm run build
pm2 restart frontend
```

---

## Post-Migration Verification

### Automated Checks

Run the E2E test suite:

```bash
cd backend
pnpm run test:e2e
```
