# Local Development with Docker Compose

This guide covers running the SimStudio project locally using Docker Compose with multiple services.

## Quick Start

### Build and Start All Services

```bash
# Fresh build without cache (recommended after dependency changes)
docker-compose -f docker-compose.local.yml up -d --build --force-recreate

# Or build separately, then start
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up -d
```

### Service Startup Order

The Docker Compose configuration enforces proper startup order:

1. **PostgreSQL Database** (`db`) - Starts first, health check ensures readiness
2. **Database Migrations** (`migrations`) - Runs migration scripts, waits for db healthy
3. **Realtime Server** (`realtime`) - WebSocket server, waits for db healthy
4. **Main Application** (`simstudio`) - Next.js app, waits for all above services

Dependency configuration:
```yaml
simstudio:
  depends_on:
    db:
      condition: service_healthy
    migrations:
      condition: service_completed_successfully
    realtime:
      condition: service_healthy
```

### View Logs

Monitor all services:
```bash
docker-compose -f docker-compose.local.yml logs -f
```

Monitor specific services:
```bash
docker-compose -f docker-compose.local.yml logs -f simstudio    # Main app
docker-compose -f docker-compose.local.yml logs -f realtime     # WebSocket server
docker-compose -f docker-compose.local.yml logs -f db           # Database
docker-compose -f docker-compose.local.yml logs -f migrations   # Migration logs
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# Required for authentication
BETTER_AUTH_SECRET=your_auth_secret_here
ENCRYPTION_KEY=your_encryption_key_here
INTERNAL_API_SECRET=your_internal_api_secret_here
API_ENCRYPTION_KEY=your_api_encryption_key_here

# Optional integrations
COPILOT_API_KEY=<optional>
SIM_AGENT_API_URL=<optional>

# Database
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=simstudio
POSTGRES_PORT=5432

# Application URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000
BETTER_AUTH_URL=http://localhost:3000
SOCKET_SERVER_URL=http://localhost:3002
NEXT_PUBLIC_SOCKET_URL=http://localhost:3002

# LLM Services
OLLAMA_URL=http://localhost:11434
```

### Port Mapping

- **3000** - Main SimStudio application (Next.js)
- **3002** - Realtime server (WebSocket)
- **5432** - PostgreSQL database (localhost only)
- **11434** - Ollama LLM server (if running)

## Troubleshooting

### Issue: Build Fails with "Workspace dependency not found"

```
error: Workspace dependency "@sim/testing" not found
```

**Solution:** Use `--no-cache` flag to bypass stale build cache:

```bash
docker-compose -f docker-compose.local.yml build --no-cache
docker-compose -f docker-compose.local.yml up -d
```

Or clear all build cache:
```bash
docker builder prune
docker-compose -f docker-compose.local.yml up -d --build
```

### Issue: Port Already in Use

```
Error starting userland proxy: Bind for 0.0.0.0:3000
```

**Solutions:**

Option A - Stop existing containers:
```bash
docker-compose -f docker-compose.local.yml down
```

Option B - Use different ports in `.env`:
```env
# Modify the compose override or use a different file
```

Option C - Kill process on port:
```bash
# macOS/Linux
lsof -i :3000
kill <PID>

# Or stop all Docker containers
docker stop $(docker ps -q)
```

### Issue: Database Connection Error

```
error: could not connect to server: Connection refused
```

**Solutions:**

1. Ensure db service is healthy:
```bash
docker-compose -f docker-compose.local.yml ps
# db service should have "healthy" status
```

2. Check database logs:
```bash
docker-compose -f docker-compose.local.yml logs db
```

3. Verify DATABASE_URL format:
```env
DATABASE_URL=postgresql://postgres:postgres@db:5432/simstudio
```

4. Wait for health check (may take 10-15 seconds):
```bash
# Check service status
docker-compose -f docker-compose.local.yml ps

# Wait for all services
sleep 30
docker-compose -f docker-compose.local.yml logs
```

### Issue: Migrations Fail to Run

```
service "migrations" exited with code 1
```

**Solutions:**

1. Check migration logs:
```bash
docker-compose -f docker-compose.local.yml logs migrations
```

2. Verify database is healthy before migrations:
```bash
# Check db is ready
docker-compose -f docker-compose.local.yml ps db
```

3. Manually run migrations in container:
```bash
docker-compose -f docker-compose.local.yml exec migrations \
  bun run db:migrate
```

### Issue: Application Shows No Data

Ensure migrations completed successfully:

```bash
docker-compose -f docker-compose.local.yml logs migrations
docker-compose -f docker-compose.local.yml ps migrations
# Status should be "Exit 0"
```

## Common Commands

### Stop All Services

```bash
docker-compose -f docker-compose.local.yml down
```

### Remove All Data (Reset Database)

```bash
docker-compose -f docker-compose.local.yml down -v
# Then rebuild and start fresh
docker-compose -f docker-compose.local.yml up -d --build
```

### Execute Commands in Container

```bash
# Access shell in main app
docker-compose -f docker-compose.local.yml exec simstudio bash

# Run bun command
docker-compose -f docker-compose.local.yml exec simstudio bun --version

# Access database
docker-compose -f docker-compose.local.yml exec db psql -U postgres -d simstudio
```

### View Running Container Processes

```bash
docker-compose -f docker-compose.local.yml ps
```

### Update a Single Service

```bash
docker-compose -f docker-compose.local.yml up -d --build simstudio
```

## Service Details

### simstudio (Next.js Application)

- **Image**: Built from `docker/app.Dockerfile`
- **Port**: 3000
- **Health Check**: HTTP GET to `http://localhost:3000`
- **Dependencies**: db (healthy), migrations (completed), realtime (healthy)
- **Memory**: 12GB reserved, 16GB limit

### realtime (WebSocket Server)

- **Image**: Built from `docker/realtime.Dockerfile`
- **Port**: 3002
- **Health Check**: Wget to `http://localhost:3002/health`
- **Dependencies**: db (healthy)
- **Memory**: 12GB reserved, 16GB limit
- **Start Command**: `bun socket/index.ts`

### migrations (Database Setup)

- **Image**: Built from `docker/db.Dockerfile`
- **Command**: `bun run db:migrate`
- **Dependencies**: db (healthy)
- **Auto-restart**: No (runs once, exits on completion)

### db (PostgreSQL)

- **Image**: `pgvector/pgvector:pg17`
- **Port**: 5432 (localhost only)
- **Volume**: `postgres_data:/var/lib/postgresql/data`
- **Health Check**: `pg_isready -U postgres`
- **Auto-restart**: Yes

## Advanced

### Rebuild Specific Service

```bash
docker-compose -f docker-compose.local.yml build --no-cache simstudio
```

### View Docker Compose Config

```bash
docker-compose -f docker-compose.local.yml config
```

### Run One-Off Command

```bash
docker-compose -f docker-compose.local.yml run --rm simstudio \
  bun run build
```

### Check Resource Usage

```bash
docker stats
```

### Prune Unused Docker Resources

```bash
# Remove unused images
docker image prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Remove everything unused (safe)
docker system prune
```
