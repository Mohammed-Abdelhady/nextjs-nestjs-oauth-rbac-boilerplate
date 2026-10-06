# Migration verification and troubleshooting

[Guide overview](MIGRATION-GUIDE.md)

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
cd backend && pnpm run migration:up

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
