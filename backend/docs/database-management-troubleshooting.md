# Database troubleshooting and best practices

[Guide overview](database-management.md)

### Migration Issues

#### Migration Already Applied

```
Error: Migration already applied
```

**Solution**: Check migration status and only apply pending migrations:

```bash
pnpm run migration:status
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
pnpm run migration:status

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
NODE_ENV=development pnpm run seed
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
pnpm run build
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
sudo pnpm run seed
```

---

## Best Practices

### Development Workflow

1. **Start with migrations**:

   ```bash
   pnpm run migration:up
   ```

2. **Seed the database**:

   ```bash
   pnpm run seed
   ```

3. **Develop and test**:
   - Use seed users for testing
   - Test all user roles
   - Verify RBAC functionality

4. **Reset when needed**:
   ```bash
   pnpm run seed:reset
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
