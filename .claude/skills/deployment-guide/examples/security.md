# Security Best Practices for Deployment

Essential security practices for containerized applications and cloud deployments.

## Container Security

### 1. Use Non-Root Users

```dockerfile
# Create non-root user
RUN groupadd -g 1001 nodejs && \
    useradd -u 1001 -g nodejs appuser

# Copy files with ownership
COPY --chown=appuser:appuser /app/src ./src

# Switch to user
USER appuser

# Start as user
CMD ["node", "index.js"]
```

**Why:** Prevents privilege escalation and container breakout attacks

### 2. Minimal Base Images

```dockerfile
# ✅ Good - Slim images
FROM python:3.13-slim
FROM node:22-alpine
FROM oven/bun:1.3.3-slim

# ❌ Bad - Full images
FROM python:3.13
FROM node:22
```

**Why:** Reduces attack surface and image size

### 3. Don't Include Secrets in Images

```dockerfile
# ❌ Bad - Secrets in Dockerfile
ENV API_KEY="sk-1234567890abcdef"
ENV DATABASE_PASSWORD="password123"

# ✅ Good - Use environment variables
ARG API_KEY
ENV API_KEY=${API_KEY}  # Build-time only
# Runtime secrets from platform (Render, K8s Secrets, etc.)
```

**Why:** Secrets committed to version control cannot be revoked

### 4. Scan Images for Vulnerabilities

```bash
# Docker Scout (built-in)
docker scout quickstart myapp:1.0.0

# Trivy
docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
    aquasec/trivy image myapp:1.0.0

# Snyk
snyk container test myapp:1.0.0
```

### 5. Keep Base Images Updated

```dockerfile
# Pin major version but allow updates
FROM oven/bun:1.3.3-slim  # Update regularly to latest 1.3.x
```

**Why:** Security patches included in base image updates

## Secrets Management

### 1. Use Platform Secret Managers

**Render:**
```yaml
envVars:
  - key: API_SECRET
    generateValue: true  # Auto-generate
  - key: EXTERNAL_KEY
    sync: false  # Manual input in dashboard
```

**Kubernetes:**
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: api-secret
type: Opaque
data:
  key: <base64-encoded-value>
```

**GitHub Actions:**
```yaml
env:
  API_KEY: ${{ secrets.API_KEY }}
```

### 2. Never Commit Secrets

**Good:**
```
.env                # In .gitignore
.env.example        # Template without values
secrets/           # In .gitignore
```

**Bad:**
```
.env                # ❌ Contains actual secrets
credentials.json    # ❌ API keys and tokens
```

### 3. Rotate Secrets Regularly

```bash
# Generate new secret
openssl rand -hex 32

# Update in platform dashboard
# Redeploy application
```

## Network Security

### 1. Limit Container Capabilities

```dockerfile
# Drop unnecessary capabilities
# Requires runtime configuration
```

### 2. Use Private Networks

```yaml
# docker-compose.yml
services:
  app:
    networks:
      - private-net
      - public-net

  db:
    networks:
      - private-net  # Only accessible to app

networks:
  private-net:
    internal: true
  public-net:
```

### 3. IP Allow Lists

**Render:**
```yaml
databases:
  - name: app-db
    ipAllowList:
      - source: 10.0.0.0/8  # VPN/Office network
        description: Office network
      - source: 203.0.113.4/30  # Specific IP
        description: Home IP
```

## Resource Limits

### 1. Set Memory Limits

```yaml
# Kubernetes
resources:
  limits:
    memory: "512Mi"
  requests:
    memory: "256Mi"

# Render (via plan)
plan: standard  # 2 GB RAM limit
```

**Why:** Prevents DoS attacks and runaway processes

### 2. Set CPU Limits

```yaml
# Kubernetes
resources:
  limits:
    cpu: "500m"
  requests:
    cpu: "250m"
```

## Dependency Security

### 1. Pin Dependency Versions

```json
// package.json
{
  "dependencies": {
    "express": "4.18.2",      // Pinned
    "postgres": "^3.4.5",        // Minor version range
    "lodash": "4.17.21"          // Pinned
  }
}
```

### 2. Use npm ci for Production

```dockerfile
# ✅ Good - Deterministic
RUN npm ci --only=production

# ❌ Bad - May install different versions
RUN npm install
```

### 3. Scan Dependencies

```bash
# npm audit
npm audit --audit-level=moderate

# Snyk
snyk test

# Snyk container
snyk container test myapp:1.0.0
```

## Runtime Security

### 1. Enable HTTPS/TLS

```yaml
# Kubernetes Ingress
spec:
  tls:
    - hosts:
        - myapp.example.com
      secretName: tls-secret
```

### 2. Use Secure Headers

```typescript
// Middleware
app.use(helmet())  // Sets security headers
```

### 3. Validate Input

```typescript
// Use validation libraries (zod, joi, yup)
import { z } from 'zod'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
})
```

## Access Control

### 1. Principle of Least Privilege

- Grant minimum necessary permissions
- Use role-based access control (RBAC)
- Audit access logs regularly

### 2. Authentication & Authorization

```typescript
// Always authenticate
if (!req.user) {
  return res.status(401).json({ error: 'Unauthorized' })
}

// Check permissions
if (req.user.role !== 'admin') {
  return res.status(403).json({ error: 'Forbidden' })
}
```

## Compliance

### 1. GDPR/Privacy

- Don't log PII unnecessarily
- Provide data deletion endpoints
- Implement consent management

### 2. SOC2/PCI Compliance

- Use encrypted connections
- Regular security audits
- Incident response procedures

## Monitoring & Alerts

### 1. Security Monitoring

```typescript
// Track failed authentication
securityLogger.log('Failed login attempt', {
  ip: req.ip,
  user: req.body.username,
  time: Date.now()
})
```

### 2. Anomaly Detection

- Monitor for unusual patterns
- Rate limit suspicious requests
- Block repeated failed attempts

### 3. Incident Response

1. **Detect**: Automated alerts
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove vulnerabilities
4. **Recover**: Restore from backups
5. **Lessons**: Post-incident review
