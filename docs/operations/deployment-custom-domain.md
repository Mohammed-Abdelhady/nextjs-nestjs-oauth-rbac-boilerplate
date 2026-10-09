# Custom domains and deployment troubleshooting

[Guide overview](deployment.md)

### Custom Domain

1. Go to project settings in Vercel
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed

---

## Troubleshooting

### Docker Issues

#### Port Already in Use

```bash
# Check what's using the port
lsof -i :3000
lsof -i :5000
lsof -i :27017

# Kill the process or change ports in docker-compose.yml
```

#### Container Won't Start

```bash
# Check logs
docker compose logs backend

# Rebuild without cache
docker compose build --no-cache backend

# Check container status
docker compose ps
```

#### MongoDB Connection Issues

```bash
# Check MongoDB logs
docker compose logs mongodb

# Verify MongoDB is healthy
docker compose exec mongodb mongosh --eval "db.adminCommand('ping')"

# Reset MongoDB volume (WARNING: deletes data)
docker compose down -v
docker compose up -d
```

#### Hot Reload Not Working

```bash
# Restart the service
docker compose restart backend

# Check volume mounts
docker compose config
```

### Vercel Issues

#### Build Fails

```bash
# Check build logs in Vercel dashboard
# Verify environment variables are set
# Test locally: pnpm run build
```

#### Environment Variables Not Working

- Ensure variables start with `NEXT_PUBLIC_` for client-side access
- Re-deploy after changing variables: `vercel --prod`
- Check variable scope (Production, Preview, Development)

#### API Calls Failing

- Verify `NEXT_PUBLIC_API_URL` is correct
- Check CORS configuration in backend
- Verify backend is accessible from Vercel

### Performance Issues

#### Slow Build Times

```bash
# Use Docker layer caching
# Ensure .dockerignore is properly configured
# Use buildkit: DOCKER_BUILDKIT=1 docker build
```

#### High Memory Usage

```bash
# Check container resource usage
docker stats

# Adjust limits in docker-compose.prod.yml
```

### Common Errors

| Error               | Solution                                                   |
| ------------------- | ---------------------------------------------------------- |
| `EADDRINUSE`        | Port already in use, kill process or change port           |
| `MongoNetworkError` | MongoDB not ready, check health status                     |
| `Module not found`  | Run `pnpm install --frozen-lockfile` in affected directory |
| `Permission denied` | Check file permissions, use non-root user                  |

---

## Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [NestJS Deployment](https://docs.nestjs.com/faq/deployment)

---

## Support

For issues or questions:

1. Check this guide's troubleshooting section
2. Review logs: `docker compose logs -f`
3. Check the project's GitHub issues
4. Consult official documentation
