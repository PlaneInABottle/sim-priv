# Security Best Practices

Comprehensive security implementation guide for Sim deployments.

## Secret Management

### Environment Variables
```bash
# Required secrets
BETTER_AUTH_SECRET=<random-32-char-string>
ENCRYPTION_KEY=<64-char-hex-string>
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Generate secure secrets
openssl rand -hex 32  # For BETTER_AUTH_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

### Secret Hierarchy
1. **Platform secrets**: Auth, encryption, database
2. **Provider secrets**: OAuth client secrets
3. **User secrets**: BYOK keys, webhook tokens

### Never Store in Code
```bash
# Bad - committed to git
const API_KEY = "sk-xxxxx"

# Good - from environment
const API_KEY = process.env.OPENAI_API_KEY
```

### Kubernetes Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sim-secrets
type: Opaque
stringData:
  better-auth-secret: "your-secret"
  encryption-key: "your-key"
---
# Reference in deployment
env:
  - name: BETTER_AUTH_SECRET
    valueFrom:
      secretKeyRef:
        name: sim-secrets
        key: better-auth-secret
```

## Encryption

### Data at Rest

#### API Keys (BYOK)
```typescript
// Keys encrypted with AES-256-GCM
const { encrypted } = await encryptSecret(apiKey)
// Stored: encrypted data + IV + auth tag

const { decrypted } = await decryptSecret(encrypted)
```

#### OAuth Tokens
- Access and refresh tokens encrypted in database
- Encryption key from ENCRYPTION_KEY env var
- Decrypted only when needed

### Data in Transit
- TLS 1.2+ required for all connections
- HTTPS enforced in production
- Database connections use SSL

### Key Derivation
```typescript
// Encryption key derived securely
const encryptionKey = Buffer.from(process.env.ENCRYPTION_KEY, 'hex')
// Must be exactly 32 bytes (256 bits)
```

## Rate Limiting

### Built-in Protection
Rate limiting applied at multiple levels:
- Per-workspace API calls
- Per-workflow executions
- Per-provider LLM requests

### Configuration
```typescript
// Default limits
{
  api: {
    requestsPerMinute: 1000,
    requestsPerHour: 10000
  },
  workflow: {
    executionsPerMinute: 100,
    concurrentExecutions: 10
  }
}
```

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1704067200
```

### Handling Rate Limits
```typescript
if (response.status === 429) {
  const retryAfter = response.headers.get('Retry-After')
  await sleep(parseInt(retryAfter) * 1000)
  return retry()
}
```

## Rate Limit Detection

The executor automatically detects and handles rate limits:

### Provider Rate Limits
```typescript
// OpenAI rate limit response
{
  "error": {
    "type": "rate_limit_error",
    "message": "Rate limit reached"
  }
}

// Automatic retry with backoff
```

### Backoff Strategy
```typescript
const backoffMs = Math.min(
  initialDelay * Math.pow(2, attempt),
  maxDelay
)
```

## DDoS Mitigation

### Infrastructure Level
- CDN/WAF (Cloudflare, AWS Shield)
- Load balancer rate limiting
- Geographic restrictions if applicable

### Application Level
- Request size limits
- Timeout configurations
- Connection limits

### Webhook Protection
```typescript
{
  type: 'generic_webhook',
  data: {
    requireAuth: true,  // Require authentication
    rateLimit: 100,     // Requests per minute
    timeout: 30000      // 30 second timeout
  }
}
```

## Input Validation

### API Input
```typescript
// Validate input format
const schema = z.object({
  message: z.string().max(10000),
  userId: z.string().uuid()
})
const validated = schema.parse(input)
```

### File Upload Limits
```typescript
// Configured in Next.js
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb'
    }
  }
}
```

### SQL Injection Prevention
- Use parameterized queries (Drizzle ORM)
- Never concatenate user input
- Validate input types

## Authentication Security

### Session Management
```typescript
// Session configuration
{
  maxAge: 30 * 24 * 60 * 60,  // 30 days
  httpOnly: true,
  secure: true,
  sameSite: 'lax'
}
```

### Password Security
- Bcrypt hashing (cost factor 10+)
- Minimum password requirements
- Breach detection (optional)

### OAuth Security
- State parameter for CSRF protection
- PKCE for public clients
- Secure token storage

## Logging and Monitoring

### Security Events to Log
```typescript
// Log authentication events
logger.info('User authenticated', { userId, method: 'oauth', provider })
logger.warn('Failed login attempt', { email, ip, attempts })
logger.error('Token refresh failed', { userId, provider, error })
```

### Sensitive Data Redaction
```typescript
// Never log secrets
logger.info('API call', { 
  keyId: 'key_xxx',  // OK
  apiKey: '[REDACTED]'  // Don't log actual key
})
```

### Alerting
- Failed auth spike
- Rate limit exceeded frequently
- Token refresh failures
- Unusual API patterns

## Security Headers

### Recommended Headers
```typescript
// Next.js middleware or headers
{
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Content-Security-Policy': "default-src 'self'",
  'Referrer-Policy': 'strict-origin-when-cross-origin'
}
```

## Self-Hosted Security

### Network Security
- Run in private network
- Use VPN for access
- Restrict database access
- Enable firewall rules

### Docker Security
```yaml
# docker-compose security options
services:
  sim:
    security_opt:
      - no-new-privileges:true
    read_only: true
    user: "1000:1000"
```

### Database Security
```bash
# PostgreSQL with SSL
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=verify-full

# Redis with password
REDIS_URL=rediss://:password@host:6379
```

## Incident Response

### Key Compromise
1. Revoke compromised key immediately
2. Generate new key
3. Update all applications
4. Review audit logs
5. Assess impact
6. Document incident

### OAuth Token Leak
1. Revoke tokens in database
2. Notify affected users
3. Force reauthorization
4. Review access logs

### Database Breach
1. Rotate encryption keys
2. Force password resets
3. Revoke all sessions
4. Audit data access
5. Notify affected users (if required)

## Compliance Considerations

### Data Residency
- Deploy in appropriate regions
- Configure storage locations
- Document data flows

### Audit Requirements
- Enable comprehensive logging
- Retain logs per policy
- Implement access reviews

### Data Retention
- Define retention policies
- Implement automated cleanup
- Document deletion procedures
