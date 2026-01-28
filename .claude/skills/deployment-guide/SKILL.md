---
name: deployment-guide
description: Create and optimize Dockerfiles, configure Docker Compose for multi-container development, set up Render.com Blueprints for production, and deploy with Kubernetes/Helm. Troubleshoot build errors, manage environment variables, and implement health checks.
when_to_use: Use this skill when you need to dockerize applications, set up local development environments with Docker Compose, deploy to Render.com, troubleshoot Docker build failures, or manage containerized deployments.
---

# Deployment Guide

This comprehensive skill guides you through application deployment across multiple platforms and deployment patterns. It covers Dockerfiles, Docker Compose, Kubernetes/Helm, Render.com Blueprints, CI/CD pipelines, and troubleshooting common deployment issues.

## When to Use This Skill

Use this deployment-guide skill when:
- Creating or optimizing Dockerfiles for applications
- Configuring Docker Compose for multi-container deployments
- Setting up Kubernetes deployments or Helm charts
- Creating Render.com Blueprint (render.yaml) configurations
- Troubleshooting deployment failures or build errors
- Setting up CI/CD pipelines for containerized applications
- Migrating applications to container-based deployments
- Optimizing container images for production

## What This Skill Provides

This skill helps you create production-ready deployment configurations through:

1. **Dockerfile patterns** for multiple application types (Next.js, Python Flask, Node.js)
2. **Render.com Blueprint templates** for web services, databases, and monorepos
3. **Docker Compose configurations** for development and multi-container setups
4. **Kubernetes and Helm examples** for cloud deployments
5. **Troubleshooting guides** for common deployment issues
6. **Best practices** for security, performance, and reliability

---

## Dockerfile Creation and Optimization

### Basic Dockerfile Structure

```dockerfile
# Base image selection criteria
- Official images preferred (node, python, bun, etc.)
- Specific versions pinned for reproducibility
- Alpine/slim variants for smaller images

# Multi-stage builds (for production)
- Builder stage: Dependencies and build
- Runtime stage: Only runtime dependencies
- Reduces final image size

# Non-root user pattern
- Security best practice
- Prevents privilege escalation
```

### Common Dockerfile Patterns

#### Pattern 1: Next.js with Bun (Multi-stage)

```dockerfile
# ========================================
# Base Stage: Debian-based Bun with Node.js 22
# ========================================
FROM oven/bun:1.3.3-slim AS base

# Install Node.js 22 and common dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip python3-venv make g++ curl ca-certificates bash ffmpeg \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs

# ========================================
# Dependencies Stage
# ========================================
FROM base AS deps
WORKDIR /app

COPY package.json bun.lock turbo.json ./
RUN mkdir -p apps packages/db packages/tsconfig
COPY apps/sim/package.json ./apps/sim/package.json
COPY packages/db/package.json ./packages/db/package.json

RUN bun install -g turbo && \
    HUSKY=0 bun install --omit=dev --ignore-scripts --linker=hoisted

# ========================================
# Builder Stage
# ========================================
FROM base AS builder
WORKDIR /app

RUN bun install -g turbo

COPY --from=deps /app/node_modules ./node_modules
COPY package.json bun.lock turbo.json ./
COPY apps/sim ./apps/sim
COPY packages ./packages

ENV NEXT_TELEMETRY_DISABLED=1 \
    VERCEL_TELEMETRY_DISABLED=1 \
    DOCKER_BUILD=1

RUN bun run build

# ========================================
# Runner Stage
# ========================================
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/sim/public ./apps/sim/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/sim/.next/standalone ./

USER nextjs

EXPOSE 3000
ENV PORT=3000 HOSTNAME="0.0.0.0"

CMD ["bun", "apps/sim/server.js"]
```

**Key Features:**
- Multi-stage build (deps → builder → runner)
- Bun + Node.js 22 dual runtime
- Non-root user (nextjs)
- Standalone Next.js build
- Cached dependencies between stages

#### Pattern 2: Python Flask/FastAPI

```dockerfile
FROM python:3.13-slim

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    gcc \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .

# Create non-root user
RUN useradd --create-home --shell /bin/bash appuser
RUN chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 5000

# Run with gunicorn for production
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "4", "app:app"]
```

**Key Features:**
- Slim Python base image
- Gunicorn WSGI server
- Multiple workers (adjust based on CPU cores)
- Non-root user

#### Pattern 3: Simple Node.js Application

```dockerfile
FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node healthcheck.js

# Start application
CMD ["node", "index.js"]
```

### Critical Dockerfile Considerations

1. **COPY command paths must exist in build context**
   - Problem: COPY references deleted package
   - Fix: Remove or update COPY commands
   - Example: Our `@libsql` issue - package removed but still copied in Dockerfile

2. **FROM stage references must be correct**
   - Problem: `--from=stage` where stage doesn't exist
   - Check: Verify all stage names are defined
   - Fix: Correct stage names in COPY commands

3. **CMD/ENTRYPOINT must match deployment start command**
   - For Render Docker: `dockerCommand` in render.yaml must match Dockerfile CMD
   - For native runtimes: `startCommand` in render.yaml

4. **WORKDIR must be consistent across stages**
   - Change only when intentional
   - COPY paths relative to current WORKDIR

5. **EXPOSE port must match application expectations**
   - Verify: PORT environment variable matches EXPOSE
   - Common: 3000 (Next.js), 5000 (Flask), 8080 (development)

---

## Render.com Blueprint Configuration

### Blueprint Fundamentals

- **File name**: `render.yaml` (must be in repository root)
- **Automatic detection**: Render detects blueprint when connecting repo
- **Service types**: web, pserv, worker, cron, keyvalue
- **Runtimes**: docker, node, python, ruby, go, etc.

### Service Types and Runtimes

#### Web Services (public-facing applications)

**Docker Runtime:**
```yaml
services:
  - type: web
    name: my-app
    runtime: docker
    dockerfilePath: ./Dockerfile
    dockerContext: .
    dockerCommand: bun start
    healthCheckPath: /health
```

**Native Runtime:**
```yaml
services:
  - type: web
    name: my-app
    runtime: node
    buildCommand: npm install
    startCommand: node index.js
    healthCheckPath: /health
```

**Key Difference:**
- Docker: `dockerCommand`, `dockerfilePath`, `dockerContext`
- Native: `buildCommand`, `startCommand`

#### Private Services (internal network only)

```yaml
services:
  - type: pserv
    name: internal-api
    runtime: docker
    dockerfilePath: ./Dockerfile
    ipAllowList: []  # Only internal access
```

#### Background Workers

```yaml
services:
  - type: worker
    name: job-processor
    runtime: node
    startCommand: node worker.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: app-db
          property: connectionString
```

#### Scheduled Jobs (Cron)

```yaml
services:
  - type: cron
    name: daily-backup
    runtime: python
    schedule: "0 2 * * *"  # Daily at 2 AM UTC
    startCommand: python backup.py
```

### Database Configuration

#### Valid Database Plans

**Basic Tier:**
- basic-256mb (256 MB RAM, minimal)
- basic-1gb (1 GB RAM)
- basic-4gb (4 GB RAM)
- basic-8gb (8 GB RAM)

**Pro Tier:**
- pro-4gb (1 CPU, 4 GB RAM)
- pro-8gb (2 CPU, 8 GB RAM)
- pro-16gb (4 CPU, 16 GB RAM)
- pro-32gb (8 CPU, 32 GB RAM)

**Legacy:**
- free (30-day expiry, 1 GB storage)

**PostgreSQL Versions:**
- Valid: 13, 14, 15, 16, 17
- Format: String with quotes `'16'`
- Cannot modify after creation

#### Database Configuration Example

```yaml
databases:
  - name: app-db
    plan: basic-256mb
    postgresMajorVersion: '16'
    databaseName: production_db  # Optional
    user: app_user             # Optional
    diskSizeGB: 10            # Optional, multiple of 5
```

### Environment Variables

#### Pattern: Hardcoded Values

```yaml
envVars:
  - key: NODE_ENV
    value: production
```

#### Pattern: Generated Secrets

```yaml
envVars:
  - key: APP_SECRET
    generateValue: true  # Generates 256-bit base64 secret
```

#### Pattern: Manual Input (sync: false)

```yaml
envVars:
  - key: EXTERNAL_API_KEY
    sync: false  # Prompts in dashboard, not copied to previews
```

#### Pattern: Database References

```yaml
envVars:
  - key: DATABASE_URL
    fromDatabase:
      name: my-database
      property: connectionString  # Valid: connectionString, host, port
```

#### Pattern: Service References

```yaml
envVars:
  - key: SHARED_SECRET
    fromService:
      type: web          # Valid: web, pserv, worker, cron, keyvalue
      name: api-service
      envVarKey: SECRET_KEY  # Note: envVarKey, not property
```

#### Pattern: Environment Groups

```yaml
envVars:
  - fromGroup: production-secrets  # Add all variables from group
```

### Health Check Configuration

#### Health Check Requirements

- **Field**: `healthCheckPath`
- **Response**: Must return 2xx or 3xx status code
- **Timeout**: 5 seconds maximum
- **Failure behavior**:
  - 15 seconds consecutive → Stop routing
  - 60 seconds consecutive → Restart service

#### Common Health Check Paths

- `/health` - Simple health endpoint
- `/api/health` - API health check
- `/` - Root path check

#### Health Check Implementation

```typescript
// apps/sim/app/api/health/route.ts
export async function GET() {
  try {
    // Check critical dependencies
    await db.query('SELECT 1')

    return Response.json(
      { status: 'ok', timestamp: new Date().toISOString() },
      { status: 200 }
    )
  } catch {
    return Response.json(
      { status: 'error' },
      { status: 503 }
    )
  }
}
```

### Common Render Blueprint Issues

#### Issue 1: Dockerfile Not Found

**Error:**
```
error: failed to solve: failed to read dockerfile: open Dockerfile: no such file or directory
```

**Causes:**
- `dockerfilePath` points to non-existent file
- Dockerfile in subdirectory but path incorrect

**Solutions:**

Option A - Use correct path:
```yaml
dockerfilePath: ./docker/app.Dockerfile
```

Option B - Use rootDir (recommended for monorepos):
```yaml
services:
  - type: web
    rootDir: docker
    dockerfilePath: app.Dockerfile
    dockerContext: .
```

Option C - Move Dockerfile to root:
```yaml
dockerfilePath: ./Dockerfile  # Dockerfile at repo root
```

#### Issue 2: Wrong Command Field

**Problem**: Using `startCommand` with `runtime: docker`

**Correct:**
```yaml
# Docker runtime
runtime: docker
dockerCommand: bun start  # Use dockerCommand

# Native runtime
runtime: node
startCommand: node index.js  # Use startCommand
```

#### Issue 3: Invalid Database Plan

**Problem**: Using web service plans for databases

**Incorrect:**
```yaml
databases:
  - plan: standard  # ❌ This is a web service plan
```

**Correct:**
```yaml
databases:
  - plan: basic-256mb  # ✅ Database plan
```

#### Issue 4: Stale Dockerfile References

**Problem**: COPY commands reference non-existent dependencies

**Example:**
```dockerfile
COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
# But @libsql was removed from package.json
```

**Fix:**
1. Check `package.json` dependencies
2. Remove COPY lines for deleted packages
3. Verify all COPY source paths exist

#### Issue 5: Workspace Dependencies Not Found in Docker

**Problem**: Build fails with "Workspace dependency not found"

**Error:**
```
error: Workspace dependency "@sim/testing" not found
Searched in "./*"
error: @sim/testing@workspace:* failed to resolve
```

**Causes:**
- Package directory exists locally but not copied into Docker build
- Dockerfile `COPY` commands don't include the package
- Build cache contains old layer without the package

**Solutions:**

Option A - Clean build without cache (recommended):
```bash
docker build -f docker/realtime.Dockerfile . --no-cache
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up --build --force-recreate
```

Option B - Clear Docker build cache:
```bash
docker builder prune
docker-compose build
```

Option C - Update Dockerfile (if package was added):
```dockerfile
# deps stage
RUN mkdir -p apps packages/db packages/logger packages/testing packages/tsconfig
COPY packages/testing/package.json ./packages/testing/package.json

# builder stage
COPY packages ./packages

# runner stage (multi-stage)
COPY --from=builder --chown=nextjs:nodejs /app/packages/testing ./packages/testing
```

### Monorepo Support

#### Using rootDir for Service Scoping

```yaml
services:
  # Frontend application
  - type: web
    name: frontend
    runtime: node
    rootDir: frontend  # Only tracks changes in frontend/
    buildCommand: npm install
    startCommand: npm start

  # Backend API
  - type: web
    name: backend
    runtime: python
    rootDir: backend  # Only tracks changes in backend/
    buildCommand: pip install -r requirements.txt
    startCommand: python app.py
```

**Benefits:**
- Builds only trigger for relevant code changes
- Independent deployment cycles
- Cleaner service separation

#### rootDir Path Resolution

All commands relative to rootDir:
```yaml
services:
  - type: web
    rootDir: apps/backend
    buildCommand: pip install -r requirements.txt  # Relative to apps/backend
    startCommand: python app.py                  # Relative to apps/backend
```

---

## Docker Compose Configuration

### Use Cases

- Local development environments
- Multi-container applications
- Database + application stacks
- Preview/staging environments

### Key Configuration Elements

```yaml
version: "3.8"

services:
  app:
    build: .                              # Dockerfile path
    ports: ["3000:3000"]               # Port mapping
    volumes: ["./app:/app"]              # Code mounting
    environment:
      - NODE_ENV=development
    depends_on:
      - db                                # Startup ordering

  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=dev
    volumes:
      - pgdata:/var/lib/postgresql/data  # Data persistence

volumes:
  pgdata:                                   # Named volume
```

### Common Docker Compose Patterns

#### Pattern 1: Development Environment

```yaml
version: "3.8"

services:
  app:
    build: .
    ports: ["3000:3000"]
    volumes:
      - ./apps/sim:/app  # Hot reload for development
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgres://postgres:dev@db:5432/app
    depends_on:
      - db

  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=dev
      - POSTGRES_DB=app
    ports: ["5432:5432"]  # External access
```

#### Pattern 2: Multi-Service Architecture

```yaml
version: "3.8"

services:
  # Next.js frontend
  frontend:
    build: ./apps/frontend
    ports: ["3000:3000"]
    environment:
      - NEXT_PUBLIC_API_URL=http://backend:4000
    depends_on:
      - backend

  # Python backend
  backend:
    build: ./apps/backend
    ports: ["4000:4000"]
    environment:
      - DATABASE_URL=postgres://postgres:dev@db:5432/api
    depends_on:
      - db

  # PostgreSQL database
  db:
    image: postgres:16
    environment:
      - POSTGRES_PASSWORD=dev
    volumes:
      - pgdata:/var/lib/postgresql/data

volumes:
  pgdata:
```

#### Pattern 3: Production-Ready Stack

```yaml
version: "3.8"

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.prod
    restart: unless-stopped
    environment:
      - NODE_ENV=production
    depends_on:
      - db
      - redis
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  db:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      - POSTGRES_PASSWORD=${DB_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    command: redis-server --appendonly yes

volumes:
  pgdata:
```

### Docker Compose Commands

```bash
# Start services
docker-compose -f docker-compose.local.yml up -d

# Build and start without cache
docker-compose -f docker-compose.local.yml up -d --build --force-recreate

# Build only (no start)
docker-compose -f docker-compose.local.yml build --no-cache

# View logs for all services
docker-compose -f docker-compose.local.yml logs -f

# View logs for specific service
docker-compose -f docker-compose.local.yml logs -f simstudio
docker-compose -f docker-compose.local.yml logs -f realtime
docker-compose -f docker-compose.local.yml logs -f db

# Stop services
docker-compose -f docker-compose.local.yml down

# Remove volumes (clean slate)
docker-compose -f docker-compose.local.yml down -v

# View service status
docker-compose -f docker-compose.local.yml ps

# Execute command in running service
docker-compose -f docker-compose.local.yml exec simstudio bash
```

### Service Dependencies and Health Checks

The local compose file includes health checks and service dependencies:

```yaml
simstudio:
  # Waits for db (healthy), migrations (completed), realtime (healthy)
  depends_on:
    db:
      condition: service_healthy
    migrations:
      condition: service_completed_successfully
    realtime:
      condition: service_healthy

realtime:
  # Waits for db (healthy)
  depends_on:
    db:
      condition: service_healthy
```

This ensures proper startup order: **db → migrations → realtime → simstudio**

---

## Kubernetes and Helm

### Kubernetes Deployment Objects

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: app
spec:
  replicas: 3
  selector:
    matchLabels:
      app: myapp
  template:
    metadata:
      labels:
        app: myapp
    spec:
      containers:
      - name: app
        image: myregistry/myapp:1.0.0
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: app
spec:
  selector:
    app: myapp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: LoadBalancer
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: app-config
data:
  NODE_ENV: "production"
---
apiVersion: v1
kind: Secret
metadata:
  name: db-secret
type: Opaque
data:
  url: <base64-encoded-database-url>
```

### Helm Chart Structure

```
helm/myapp/
├── Chart.yaml              # Chart metadata
├── values.yaml             # Default configuration
├── values-dev.yaml         # Environment-specific
├── values-prod.yaml        # Environment-specific
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── ingress.yaml
    ├── configmap.yaml
    └── secret.yaml
```

### Helm Deployment

```bash
# Install with default values
helm install myapp ./helm/myapp

# Install with specific values
helm install myapp ./helm/myapp -f values-prod.yaml

# Upgrade deployment
helm upgrade myapp ./helm/myapp

# Rollback to previous version
helm rollback myapp

# Uninstall
helm uninstall myapp
```

---

## CI/CD Integration

### Pipeline Stages

1. **Build**: Compile and create artifacts
2. **Test**: Run automated tests
3. **Package**: Create container images
4. **Push**: Publish to registry
5. **Deploy**: Deploy to target environment

### GitHub Actions Example

```yaml
name: Deploy to Render

on:
  push:
    branches: [main]

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v4

    - name: Build Docker image
      run: docker build -t myapp:${{ github.sha }} .

    - name: Push to registry
      run: |
        echo ${{ secrets.REGISTRY_PASSWORD }} | docker login registry.example.com -u username --password-stdin
        docker push myapp:${{ github.sha }}

    - name: Trigger Render deploy
      run: |
        curl -X POST \
          -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
          https://api.render.com/v1/services/srv-xxxxx/deploy
```

### Pipeline Best Practices

1. **Cache dependencies** between builds
2. **Run tests** before deployment
3. **Use semantic versioning** for releases
4. **Rollback** on deployment failure
5. **Separate environments** (dev, staging, production)

---

## Environment Variables Management

### Principles

- Never commit secrets to repository
- Use `.env` files for local development
- Use platform secret managers (Render, GitHub Secrets, K8s Secrets)
- Document required variables in README

### Variable Types

1. **Application configuration**: PORT, NODE_ENV, DEBUG
2. **Database connections**: DATABASE_URL, REDIS_HOST
3. **API keys and secrets**: JWT_SECRET, API_KEY (use secret managers)
4. **Feature flags**: FEATURE_X_ENABLED (can be committed)

### Render Environment Variables

- `generateValue: true` - Auto-generate secrets
- `sync: false` - Manual input required
- `fromDatabase` - Reference database properties
- `fromService` - Reference other service variables
- `value` - Hardcoded non-secret values

---

## Health Checks and Monitoring

### Health Check Requirements

- Lightweight endpoint (fast response)
- Returns 200-399 status code
- Checks critical dependencies (database, external APIs)
- No authentication required

### Monitoring Strategies

1. **Application logs**: stdout/stderr for container logs
2. **Platform logs**: Render Dashboard, Kubernetes logs
3. **Metrics collection**: Prometheus, CloudWatch
4. **Error tracking**: Sentry, Rollbar
5. **Uptime monitoring**: Pingdom, UptimeRobot

---

## Troubleshooting

### Build Failures

#### Dockerfile Syntax Errors

**Symptoms**: Build fails with syntax errors

**Solutions:**
- Verify multi-stage FROM statements are correct
- Check COPY paths exist in build context
- Validate no circular stage dependencies

#### Environment Variable Validation Errors

**Symptoms**: Build fails with "Missing DATABASE_URL" or similar environment variable errors

**Solutions:**
See detailed guide in `examples/dockerfile-errors.md` → **Issue 5: Missing Environment Variables During Build**

Key points:
- Server-side code evaluates environment variables at module load time during build
- Empty strings `""` are falsy in JavaScript and fail validation checks
- Provide dummy environment variables during build: `ARG DATABASE_URL="postgres://build:build@localhost:5432/build"`
- Runtime environments override these with actual values

#### Dependency Installation Failures

**Symptoms**: npm/pip install fails

**Solutions:**
- Check `package.json`/`requirements.txt` validity
- Verify network access during build
- Use specific versions if needed

#### Container Size Issues

**Symptoms**: Image too large for registry

**Solutions:**
- Use multi-stage builds
- Choose Alpine/slim base images
- Run `docker system prune` to clean up
- Use .dockerignore to exclude unnecessary files

### Runtime Failures

#### Port Conflicts

**Symptoms**: Container won't start, port already in use

**Solutions:**
- Verify port not already in use
- Check EXPOSE in Dockerfile matches PORT env var
- Use random port mapping in development

#### Application Won't Start

**Symptoms**: Container exits immediately

**Solutions:**
- Check startup command is correct
- Verify environment variables are set
- Review application logs for errors
- Test Dockerfile locally: `docker run -it image /bin/bash`

#### Database Connection Errors

**Symptoms**: Can't connect to database

**Solutions:**
- Verify DATABASE_URL format and values
- Check database is running and accessible
- Review network/firewall settings
- Test connection from container

---

## Best Practices

### Security

1. **Use non-root users** in containers
2. **Scan images** for vulnerabilities
3. **Keep base images updated** for security patches
4. **Use secret managers** for sensitive data
5. **Implement resource limits** to prevent DoS

### Performance

1. **Optimize Docker layer caching** (order commands wisely)
2. **Use .dockerignore** to exclude unnecessary files
3. **Multi-stage builds** reduce image size
4. **Set appropriate resource limits**
5. **Monitor and scale** based on metrics

### Reliability

1. **Health checks** on all services
2. **Graceful shutdown** handling
3. **Database migrations** in pre-deploy phase
4. **Blue-green deployments** for zero downtime
5. **Rollback strategy** for failed deployments

### Maintainability

1. **Document Dockerfiles** and deployment configs
2. **Use semantic versioning**
3. **Tag images** with version + latest
4. **Separate dev/staging/production** configurations
5. **Include deployment instructions** in README

---

## Using This Skill

### When Invoked

When you:
- Ask to "debug deployment"
- Need to "create a Dockerfile"
- Want to "fix render.yaml"
- Ask about "container deployment"
- Need help with "CI/CD setup"
- Want to "troubleshoot build errors"

### What Happens

1. I'll analyze your deployment configuration
2. Validate against platform requirements
3. Identify issues and provide specific solutions
4. Generate corrected configurations
5. Provide best practice recommendations
6. Guide you through implementation

### How to Use

1. Share your deployment configuration or describe your goal
2. Explain your application stack (Node.js, Python, etc.)
3. Describe target platform (Docker, Render, K8s, etc.)
4. I'll guide you through creating/fixing your deployment setup

---

## References and Resources

- **Render Blueprint Spec**: https://render.com/docs/blueprint-spec
- **Render Documentation**: https://render.com/docs
- **Docker Documentation**: https://docs.docker.com
- **Kubernetes Documentation**: https://kubernetes.io/docs
- **Helm Documentation**: https://helm.sh/docs

---

See supporting files in this skill directory for:
- Dockerfile templates (`dockerfile-patterns/`)
- Render Blueprint examples (`render-blueprints/`)
- Docker Compose configurations (`docker-compose/`)
- Kubernetes/Helm examples (`kubernetes-helm/`)
- Troubleshooting guides (`troubleshooting/`)
- Best practices (`best-practices/`)
