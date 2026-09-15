# Deployment Guide

This guide covers deploying the FULL-MERN-AUTH-Boilerplate application using Docker Compose and Vercel.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Docker Development Setup](#docker-development-setup)
- [Docker Production Setup](#docker-production-setup)
- [Dependency Overrides](#dependency-overrides)
- [Vercel Deployment](#vercel-deployment)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before deploying, ensure you have:

- **Docker** (v20.10 or later) - [Install Docker](https://docs.docker.com/get-docker/)
- **Docker Compose** (v2.0 or later) - Included with Docker Desktop
- **Node.js** (v20 LTS) - [Install Node.js](https://nodejs.org/)
- **Git** - For cloning the repository

### Verify Installation

```bash
docker --version
docker compose version
node --version
git --version
```

---

## Docker Development Setup

### Quick Start

1. **Clone the repository**

```bash
git clone https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate.git
cd nextjs-nestjs-oauth-rbac-boilerplate
```

2. **Create environment file**

```bash
cp .env.docker.example .env.docker
```

3. **Start all services**

```bash
docker compose --env-file .env.docker up --build
```

This will:

- Start MongoDB on port 27017
- Start the NestJS backend on port 5000
- Start the Next.js frontend on port 3000
- Enable hot reload for both backend and frontend

4. **Access the application**

- Frontend: http://localhost:3000
- Backend API: http://localhost:5000
- MongoDB: mongodb://localhost:27017

### Development Commands

```bash
# Start all services in detached mode
docker compose up -d

# View logs
docker compose logs -f

# View logs for specific service
docker compose logs -f backend
docker compose logs -f frontend
docker compose logs -f mongodb

# Stop all services
docker compose down

# Stop and remove volumes (deletes database data)
docker compose down -v

# Rebuild a specific service
docker compose up -d --build backend

# Rebuild all services
docker compose up -d --build
```

### Hot Reload

Both backend and frontend support hot reload in development mode:

- **Backend**: Changes to TypeScript files trigger automatic rebuild
- **Frontend**: Changes to React/Next.js files trigger automatic rebuild

### Volume Management

MongoDB data persists in a named volume (`mongo-data`):

```bash
# List volumes
docker volume ls

# Inspect volume
docker volume inspect FULL-MERN-AUTH-Boilerplate_mongo-data

# Backup volume
docker run --rm -v nextjs-nestjs-oauth-rbac-boilerplate_mongo-data:/data -v $(pwd):/backup alpine tar czf /backup/mongo-backup.tar.gz /data

# Restore volume
docker run --rm -v nextjs-nestjs-oauth-rbac-boilerplate_mongo-data:/data -v $(pwd):/backup alpine tar xzf /backup/mongo-backup.tar.gz -C /
```

---

## Docker Production Setup

### Quick Start

1. **Create production environment file**

```bash
cp .env.docker.example .env.docker.prod
```

2. **Edit `.env.docker.prod` with production values**

```bash
# Production configuration
NODE_ENV=production
MONGO_URI=mongodb://admin:your_secure_password@mongodb:27017/authboiler?authSource=admin
MONGO_USERNAME=admin
MONGO_PASSWORD=your_secure_password
CLIENT_URL=https://yourdomain.com
NEXT_PUBLIC_API_URL=https://api.yourdomain.com
NEXT_PUBLIC_APP_URL=https://yourdomain.com
```

3. **Start production stack**

```bash
docker compose -f docker-compose.prod.yml up -d
```

### Production Commands

```bash
# Start production stack
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f

# Stop production stack
docker compose -f docker-compose.prod.yml down

# Rebuild and restart
docker compose -f docker-compose.prod.yml up -d --build

# Scale services (if needed)
docker compose -f docker-compose.prod.yml up -d --scale backend=2
```

### Security Best Practices

1. **Use strong passwords** for MongoDB authentication
2. **Don't commit** `.env.docker.prod` to version control
3. **Use HTTPS** in production (reverse proxy with nginx/caddy)
4. **Configure firewall** to only expose necessary ports
5. **Regular backups** of MongoDB volume
6. **Monitor logs** for suspicious activity
7. **Keep nginx and `trust proxy` in sync.** Every nginx proxy location declares
   `X-Forwarded-For` from `$remote_addr` instead of appending the incoming header,
   because the backend runs with `trust proxy = 1` and `@nestjs/throttler` keys its
   buckets on `req.ip`. If you ever put a load balancer or CDN in front of nginx,
   those directives and `trust proxy` must change together, and the backend must stay
   unreachable except through nginx - a client that connects to it directly sets
   `X-Forwarded-For` itself and picks its own throttle bucket.

### Resource Limits

Production compose file includes resource limits:

- **MongoDB**: 1GB memory, 1 CPU
- **Backend**: 512MB memory, 0.5 CPU
- **Frontend**: 512MB memory, 0.5 CPU

Adjust these in [`docker-compose.prod.yml`](../docker-compose.prod.yml) as needed.

---

## Dependency Overrides

The root `package.json` pins `@nestjs/platform-express`'s `multer` dependency to an exact
`2.3.0`:

```json
"overrides": {
  "@nestjs/platform-express": { "multer": "2.3.0" }
}
```

multer 2.2.0 carries four high-severity advisories (GHSA-wc9g-mqfw-jrwm,
GHSA-qfvm-cv95-jqjf, GHSA-qvfw-j98x-7q72, GHSA-535w-7cp7-47q4) and no released
`@nestjs/platform-express` declares a range that reaches 2.3.0, so the override supplies
the fixed copy rather than waiting for the framework.

- **Removal condition:** drop the override once `@nestjs/platform-express` declares
  `multer >= 2.3.0` in its own dependency range. `npm audit` reports zero either way
  once upstream catches up, so the override will not announce that it went stale.
- **Exact pin, not a caret range:** 2.3.0 is the reviewed artifact and the committed
  lockfile already fixes what `npm ci` installs. Widen it deliberately, with a fresh
  `npm audit`, rather than as a side effect of an unrelated `npm install`.
- **Residual advisory:** GHSA-535w-7cp7-47q4 is only half closed by the version bump.
  multer 2.3.0 adds `limits.fieldArrayIndexLimit` as an opt-in limit, so the
  sparse-array DoS path stays open until an upload route sets it. Nothing under
  `backend/src` parses multipart today (no `MulterModule`, `FileInterceptor` or
  `FileFieldsInterceptor`), so there is no call site to configure yet; the module that
  first adds file uploads must set `limits.fieldArrayIndexLimit` to the largest field
  index the app uses, and both this pin and that limit should be revisited together.
  Both halves are tracked in
  [#127](https://github.com/Mohammed-Abdelhady/nextjs-nestjs-oauth-rbac-boilerplate/issues/127).

---

## Vercel Deployment

### Prerequisites

- Vercel account (free tier available)
- Vercel CLI installed: `npm i -g vercel`

### Deploy Frontend to Vercel

1. **Navigate to frontend directory**

```bash
cd frontend
```

2. **Login to Vercel**

```bash
vercel login
```

3. **Deploy preview**

```bash
vercel
```

4. **Configure environment variables in Vercel dashboard**

Go to your project settings in Vercel and add:

| Variable              | Value                        | Environment |
| --------------------- | ---------------------------- | ----------- |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` | Production  |
| `NEXT_PUBLIC_APP_URL` | `https://yourdomain.com`     | Production  |

5. **Deploy to production**

```bash
vercel --prod
```

### Vercel Configuration

The [`vercel.json`](../frontend/vercel.json) file includes:

- **Framework**: Next.js (optimized)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, etc.
- **Caching**: Optimized for static assets

### Automatic Deployments

Connect your Git repository to Vercel for automatic deployments:

1. Go to Vercel dashboard
2. Click "Add New Project"
3. Import your Git repository
4. Configure root directory: `frontend`
5. Add environment variables
6. Deploy!

Now every push to `main` will trigger a production deployment, and every PR will create a preview deployment.

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
# Test locally: npm run build
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

| Error               | Solution                                         |
| ------------------- | ------------------------------------------------ |
| `EADDRINUSE`        | Port already in use, kill process or change port |
| `MongoNetworkError` | MongoDB not ready, check health status           |
| `Module not found`  | Run `npm install` in affected directory          |
| `Permission denied` | Check file permissions, use non-root user        |

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
