# Database Management Guide

This guide covers database seeding and migration operations for the FULL-MERN-AUTH-Boilerplate project.

## Table of Contents

- [Overview](#overview)
- [Environment Setup](#environment-setup)
- [Database Migrations](#database-migrations)
- [Database Seeding](#database-seeding)
- [Seed User Credentials](#seed-user-credentials)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The project includes two powerful database management tools:

1. **Migrations**: Manage database schema changes over time using `migrate-mongo`
2. **Seeding**: Populate the database with initial test data for development

Both tools are designed to be:

- **Idempotent**: Safe to run multiple times
- **Environment-aware**: Different behavior for development vs production
- **Type-safe**: Full TypeScript support
- **Well-documented**: Clear error messages and logging

---

## Environment Setup

Before running migrations or seeds, ensure your environment is configured:

### 1. Set MongoDB Connection

Create a `.env` file in the backend directory:

```bash
# backend/.env
MONGO_URI=mongodb://localhost:27017/authboiler?replicaSet=rs0
NODE_ENV=development
```

Or use the default connection string:

```
mongodb://localhost:27017/authboiler?replicaSet=rs0
```

<!-- feature:docker:start -->

When the backend runs on the host and MongoDB runs in Docker Compose, use `MONGO_URI=mongodb://USER:PASS@localhost:27017/authboiler?authSource=admin&directConnection=true`.
The replica set advertises `mongodb:27017`, which the host cannot resolve.
<!-- feature:docker:end -->

### 2. Install Dependencies

Dependencies are already installed via `package.json`:

```bash
cd backend
npm install
```

### 3. Start MongoDB

<!-- feature:docker:start -->

With Docker Compose:

```bash
docker-compose up -d mongodb
```

Or start a local single-node replica set:
<!-- feature:docker:end -->

```bash
mkdir -p ./mongodb-data
mongod --replSet rs0 --dbpath ./mongodb-data
```

`mongod` runs in the foreground, so leave it running and, once, in a second
shell:

```bash
mongosh --eval "rs.initiate()"
```

Sign-in runs in a transaction, so the server has to be a replica set; a
standalone `mongod` refuses transactions.

---

## Database Migrations

Migrations allow you to manage database schema changes systematically.

### Creating a Migration

Create a new migration file:

```bash
npm run migration:create <migration-name>
```

**Example:**

```bash
npm run migration:create add-user-preferences
```

This creates a file like: `migrations/20260118123456-add-user-preferences.js`

### Migration File Structure

Each migration file exports `up` and `down` functions:

```javascript
module.exports = {
  async up(db, client) {
    // Apply migration
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    console.log('✓ Migration applied');
  },

  async down(db, client) {
    // Rollback migration
    await db.collection('users').dropIndex('email_1');
    console.log('✓ Migration rolled back');
  },
};
```

### Applying Migrations

Apply all pending migrations:

```bash
npm run migration:up
```

### Rolling Back Migrations

Rollback the last migration:

```bash
npm run migration:down
```

### Checking Migration Status

View migration status:

```bash
npm run migration:status
```

Output example:

```
┌────────────────────────────────────────────────────────────────────────────────┐
│ Status  │ Migration ID                                                   │
├────────────────────────────────────────────────────────────────────────────────┤
│ PENDING │ 20260118000001-initial-indexes.js                             │
└────────────────────────────────────────────────────────────────────────────────┘
```

### Migration Best Practices

1. **Always test migrations** on a development database first
2. **Keep migrations reversible** - implement both `up` and `down` functions
3. **Use background index creation** for production to avoid blocking
4. **Document complex migrations** with inline comments
5. **Never modify existing migrations** - create a new one instead

---

## Database Seeding

Seeding populates the database with initial test data for development and testing.

### Running Seeds

Seed the database with test users:

```bash
npm run seed
```

Output:

```
🌱 Starting database seeding...
Environment: development
[Nest] 12345  - [SeedService] Starting database seeding...
[Nest] 12345  - [SeedService] Seeding users...
[Nest] 12345  - [SeedService] Created seed user: user@seed.local (user)
[Nest] 12345  - [SeedService] Created seed user: support@seed.local (support)
[Nest] 12345  - [SeedService] Created seed user: manager@seed.local (manager)
[Nest] 12345  - [SeedService] Created seed user: admin@seed.local (admin)
[Nest] 12345  - [SeedService] Seeding users completed: 4 users created
[Nest] 12345  - [SeedService] Database seeding completed: {"users":4,"total":4}
✅ Seeding completed successfully!
Summary: {
  "users": 4,
  "total": 4
}
```

### Resetting the Database

Clear all data and reseed:

```bash
npm run seed:reset
```

**⚠️ Warning**: This is a destructive operation that deletes all data!

### Seed Idempotency

Seeding is idempotent - safe to run multiple times:

```bash
# Run once
npm run seed
# Creates 4 users

# Run again
npm run seed
# Skips existing users, creates 0 new users
```

### Production Safety

Seeding is **blocked in production** by default:

```bash
NODE_ENV=production npm run seed
# Error: Seeding is not allowed in production environment.
```

To force seeding in production (not recommended):

```bash
# Modify seed.service.ts to add --force flag support
# Or manually create users via API
```

---

## Seed User Credentials

The following seed users are created for testing:

| Role    | Email                | Password      | Purpose              |
| ------- | -------------------- | ------------- | -------------------- |
| USER    | `user@seed.local`    | `User123!`    | Regular user testing |
| SUPPORT | `support@seed.local` | `Support123!` | Support role testing |
| MANAGER | `manager@seed.local` | `Manager123!` | Manager role testing |
| ADMIN   | `admin@seed.local`   | `Admin123!`   | Admin role testing   |

### Using Seed Users

#### Via API

```bash
# Login with seed admin
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@seed.local","password":"Admin123!"}'
```

#### Via Frontend

1. Navigate to login page
2. Enter seed credentials
3. Test role-based features

### Seed User Properties

All seed users have:

- ✅ Verified email (`isVerified: true`)
- ✅ Email authentication provider (`authProvider: 'email'`)
- ✅ Secure passwords (hashed with bcrypt)
- ✅ Proper role assignment
- ✅ No OAuth IDs (googleId, facebookId, githubId)

---

## Troubleshooting

### Migration Issues

#### Migration Already Applied

```
Error: Migration already applied
```

**Solution**: Check migration status and only apply pending migrations:

```bash
npm run migration:status
```

#### Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:27017
```

**Solution**: Ensure MongoDB is running:

```bash
# Check if MongoDB is running
ps aux | grep mongod

# Start a single-node replica set (sign-in uses transactions)
mkdir -p ./mongodb-data
mongod --replSet rs0 --dbpath ./mongodb-data
# then, in a second terminal, once:
mongosh --eval "rs.initiate()"
```

<!-- feature:docker:start -->

Or start it with Docker:

```bash
docker-compose up -d mongodb
```

<!-- feature:docker:end -->

#### Migration State Desync

If migration state becomes inconsistent:

```bash
# 1. Check current state
npm run migration:status

# 2. Manually fix migrations collection
mongo mongodb://localhost:27017/authboiler
db.migrations.find()

# 3. Remove problematic entry if needed
db.migrations.deleteOne({ fileName: 'problematic-migration.js' })
```

### Seeding Issues

#### User Already Exists

```
User already exists: admin@seed.local
```

**Solution**: This is normal behavior. Seeding is idempotent and skips existing users.

#### Production Environment Error

```
Error: Seeding is not allowed in production environment.
```

**Solution**: Set `NODE_ENV=development` or manually create users:

```bash
NODE_ENV=development npm run seed
```

#### Password Hashing Error

```
Error: data and salt arguments required
```

**Solution**: Ensure bcrypt rounds are configured in `.env`:

```bash
# backend/.env
BCRYPT_ROUNDS=10
```

#### Database Connection Error

```
Error: connect ECONNREFUSED
```

**Solution**: Check MongoDB connection string and ensure database is running:

```bash
# Test connection
mongo mongodb://localhost:27017/authboiler

# Verify .env file
cat backend/.env | grep MONGO_URI
```

### General Issues

#### TypeScript Compilation Errors

```
error TS2307: Cannot find module './user.seed'
```

**Solution**: Ensure all files are created and paths are correct:

```bash
# Verify file structure
ls -la backend/src/database/seeds/

# Rebuild if needed
cd backend
npm run build
```

#### Permission Errors

```
Error: EACCES: permission denied
```

**Solution**: Check file permissions:

```bash
# Fix permissions
chmod +x backend/src/database/seeds/index.ts

# Or run with appropriate permissions
sudo npm run seed
```

---

## Best Practices

### Development Workflow

1. **Start with migrations**:

   ```bash
   npm run migration:up
   ```

2. **Seed the database**:

   ```bash
   npm run seed
   ```

3. **Develop and test**:
   - Use seed users for testing
   - Test all user roles
   - Verify RBAC functionality

4. **Reset when needed**:
   ```bash
   npm run seed:reset
   ```

### Production Deployment

1. **Test migrations** on staging first
2. **Backup database** before applying migrations
3. **Apply migrations** during maintenance window
4. **Never seed** production data
5. **Monitor** migration logs for errors

### Team Collaboration

1. **Commit migration files** to version control
2. **Document complex migrations** in pull requests
3. **Review migrations** before merging
4. **Keep seed data** minimal and focused
5. **Update documentation** when adding new seeds

### Security Considerations

1. **Never commit** real credentials
2. **Use strong passwords** even for seed data
3. **Rotate seed passwords** regularly
4. **Limit seed user access** in production
5. **Audit seed user activity** periodically

---

## Additional Resources

- [migrate-mongo Documentation](https://github.com/mongo-migrate/migrate-mongo)
- [MongoDB Index Best Practices](https://www.mongodb.com/docs/manual/indexes/)
- [NestJS Database Documentation](https://docs.nestjs.com/techniques/database)
- [Project README](../../README.md)
- [Backend README](../README.md)

---

## Support

For issues or questions:

1. Check this documentation first
2. Review migration/seed logs
3. Check MongoDB connection
4. Verify environment variables
5. Open an issue on GitHub
