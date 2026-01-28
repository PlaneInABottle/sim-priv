# Dockerfile Build Failures

Common issues and solutions for Dockerfile build failures.

## Issue 1: COPY Command Not Found

**Error:**
```
ERROR: failed to compute cache key: "/app/node_modules/@libsql": not found
```

**Cause:** COPY command references package that no longer exists

**Solutions:**

1. Verify dependencies in package.json
```bash
grep "@libsql" package.json
# If not found, package was removed
```

2. Check COPY paths match installed packages
```dockerfile
# Remove stale COPY line
# COPY --from=builder /app/node_modules/@libsql ./node_modules/@libsql
```

3. Rebuild without cache to verify fix
```bash
docker build --no-cache -t myapp .
```

## Issue 2: Invalid Stage Reference

**Error:**
```
ERROR: failed to solve: failed to compute cache key: stage "builder" does not exist
```

**Cause:** FROM or COPY references undefined stage

**Solutions:**

1. Verify all stage names are defined
```dockerfile
# Check all FROM statements
FROM base AS deps     # Stage 1
FROM base AS builder   # Stage 2
FROM base AS runner    # Stage 3

# Verify COPY uses existing stage names
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
```

2. Fix typos in stage names
```dockerfile
# FROM base AS bilder   # Typo
# Fix to:
# FROM base AS builder     # Correct
```

## Issue 3: Permission Denied Errors

**Error:**
```
ERROR: failed to solve: permission denied while trying to connect
```

**Cause:** File permissions or user issues

**Solutions:**

1. Use chown or COPY with --chown
```dockerfile
# Create user first
RUN useradd -u 1001 -g nodejs appuser

# Copy with ownership
COPY --chown=appuser:appuser /app/src ./src
```

2. Ensure correct user in final stage
```dockerfile
# All COPY commands before USER
COPY --from=builder --chown=appuser:appuser /app/dist ./dist

# Switch to user
USER appuser

# Start as user
CMD ["node", "index.js"]
```

## Issue 4: Module Not Found

**Error:**
```
Error: Cannot find module 'express'
```

**Cause:** Dependencies not installed or wrong WORKDIR

**Solutions:**

1. Verify WORKDIR is correct
```dockerfile
# Before RUN npm install
WORKDIR /app
COPY package*.json ./
RUN npm install
```

2. Copy node_modules in multi-stage builds
```dockerfile
# In builder stage
FROM node AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci

# In runner stage
FROM node AS runner
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY . .
CMD ["node", "index.js"]
```

## Issue 5: Missing Environment Variables During Build

**Error:**
```
Error: Missing DATABASE_URL environment variable
    at module evaluation (.next/server/chunks/packages_db_index_ts_*.js:...)
```

**Cause:** Server-side code evaluates environment variables at module load time during build (not at runtime).
If an environment variable is required but not provided or is empty, the build fails.

**Root Cause in Sim Studio:**
The `packages/db/index.ts` validates `DATABASE_URL` immediately when imported:
```typescript
const connectionString = process.env.DATABASE_URL!
if (!connectionString) {
  throw new Error('Missing DATABASE_URL environment variable')
}
```

When the Dockerfile sets `ARG DATABASE_URL=""` (empty string), the empty string is falsy in JavaScript and fails the check.

**Solutions:**

1. **Provide Dummy Environment Variables During Build (Recommended)**
```dockerfile
# Provide dummy database URL during image build
# Runtime environments MUST override this
ARG DATABASE_URL="postgres://build:build@localhost:5432/build"
ENV DATABASE_URL=${DATABASE_URL}

# Provide other dummy environment variables as needed
ARG NEXT_PUBLIC_APP_URL="http://localhost:3000"
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN bun run build
```

2. **Lazy Initialize Server Modules (Code Fix)**
```typescript
// Instead of immediate validation
let _db: DBClient | null = null

export const db = new Proxy({} as DBClient, {
  get(_, prop) {
    if (!_db) {
      const connectionString = process.env.DATABASE_URL
      if (!connectionString) throw new Error('Missing DATABASE_URL')
      _db = createConnection(connectionString)
    }
    return (_db as any)[prop]
  }
})
```

3. **Skip DB Initialization During Build**
```typescript
const isDockerBuild = process.env.DOCKER_BUILD === '1'

if (!isDockerBuild) {
  if (!connectionString) {
    throw new Error('Missing DATABASE_URL environment variable')
  }
  // Initialize connection
}

export { db }
```

**Key Points:**
- Empty strings `""` are falsy in JavaScript, use dummy values instead
- Don't use empty ARGs/ENVs for validation checks
- Match the pattern of other build-time variables like `NEXT_PUBLIC_APP_URL`
- Document that runtime must override these dummy values

## Issue 6: Out of Memory During Build

**Error:**
```
ERROR: failed to solve: executor failed running [/bin/sh -c npm install]
signal: killed
```

**Cause:** Insufficient memory for build

**Solutions:**

1. Increase Docker memory (Docker Desktop)
   - Docker Desktop → Settings → Resources
   - Increase memory to 4GB+

2. Use multi-stage builds
   - Install dependencies in separate stage
   - Only copy needed artifacts to final stage

3. Optimize package installation
```dockerfile
# Use --production flag
RUN npm ci --only=production
```

## Debug Commands

### Inspect Build Context
```bash
# See what files are in build context
docker build --no-cache --progress=plain -t debug . 2>&1 | head -20
```

### Interactive Build Debugging
```bash
# Build and stop at specific stage
docker build --target builder -t debug-stage .

# Run that stage interactively
docker run -it debug-stage /bin/bash
# Check what files exist
ls -la
```

### Check Layer Caching
```bash
# Build with layer inspection
docker build --progress=plain -t myapp .
# See which layers are cached (CACHED)
```
