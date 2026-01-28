---
name: sim-auth-security
description: Use when configuring OAuth integrations, setting up BYOK (Bring Your Own Key), managing API keys, implementing security best practices, or troubleshooting authentication issues in Sim workflows.
---

# Sim Authentication & Security

Guide for authentication, API key management, BYOK configuration, and security best practices.

## Authentication Methods

### OAuth Integration
Connect external services (Google, Microsoft, GitHub, Slack, etc.) via OAuth:
- User authorizes Sim to access their accounts
- Tokens stored securely and auto-refreshed
- Scopes define access level per service

### API Key Authentication
For workflow execution and webhook triggers:
```bash
curl -X POST \
  -H "X-API-Key: $SIM_API_KEY" \
  -H "Content-Type: application/json" \
  https://sim.ai/api/workflows/{workflowId}/execute
```

### BYOK (Bring Your Own Key)
Use your own LLM provider API keys instead of platform keys:
- **Providers**: openai, anthropic, google, mistral
- **Benefits**: Use your own quotas and billing
- **Encryption**: Keys encrypted at rest

## BYOK Overview

### Supported Providers
| Provider | Key Format | Usage |
|----------|------------|-------|
| OpenAI | `sk-...` | LLM calls, embeddings |
| Anthropic | `sk-ant-...` | LLM calls |
| Google | API key | LLM calls (Gemini) |
| Mistral | API key | LLM calls, OCR |

### Key Hierarchy
1. **User-provided key** (in block) - highest priority
2. **BYOK workspace key** - stored encrypted
3. **Platform key** (hosted only) - may have cost multiplier based on configuration

### Configuration
Keys are configured per workspace in Settings → BYOK:
1. Navigate to workspace settings
2. Select "API Keys" tab
3. Add key for desired provider
4. Keys encrypted using AES-256-GCM

## Environment Variables

### Required for Self-Hosted
```bash
# Database
DATABASE_URL=postgresql://...
REDIS_URL=redis://...

# Authentication
BETTER_AUTH_SECRET=<random-32-char-string>
BETTER_AUTH_URL=https://your-domain.com

# OAuth (provider-specific)
AUTH_GOOGLE_ID=<client-id>
AUTH_GOOGLE_SECRET=<client-secret>
AUTH_GITHUB_ID=<client-id>
AUTH_GITHUB_SECRET=<client-secret>
AUTH_MICROSOFT_ENTRA_ID_ID=<client-id>
AUTH_MICROSOFT_ENTRA_ID_SECRET=<client-secret>

# Encryption
ENCRYPTION_KEY=<32-byte-hex-key>
```

### Optional LLM Provider Keys
```bash
# Only needed if not using BYOK
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
MISTRAL_API_KEY=...
```

## Security Checklist

### Production Deployment
- [ ] Use HTTPS for all endpoints
- [ ] Set strong `BETTER_AUTH_SECRET` (32+ random chars)
- [ ] Configure `ENCRYPTION_KEY` for secret storage
- [ ] Enable database connection encryption
- [ ] Set up rate limiting (configured by default)
- [ ] Review OAuth scopes for minimal permissions

### API Key Management
- [ ] Rotate API keys regularly
- [ ] Use separate keys for dev/staging/prod
- [ ] Never commit keys to version control
- [ ] Monitor key usage via audit logs
- [ ] Set key expiration policies

### Workflow Security
- [ ] Use variables for sensitive values, not hardcoded
- [ ] Enable webhook authentication
- [ ] Review block permissions before deployment
- [ ] Test with minimal scopes first

## Rate Limiting

Built-in rate limiting protects against abuse:
- Per-workspace limits on API calls
- Webhook execution throttling
- LLM request rate limiting per provider

### Rate Limit Detection
The executor automatically detects rate limit responses and:
1. Extracts retry-after headers
2. Implements exponential backoff
3. Logs rate limit events for monitoring

## Data Encryption

### At Rest
- API keys: AES-256-GCM encryption
- OAuth tokens: Encrypted in database
- Sensitive block data: Encrypted storage

### In Transit
- TLS 1.2+ for all connections
- Encrypted database connections
- Secure Redis connections (optional)

## Additional Resources

- See `references/oauth-integration.md` for OAuth provider setup
- See `references/byok-setup.md` for BYOK configuration details
- See `references/api-key-management.md` for key best practices
- See `references/security-practices.md` for security implementation
- See `examples/security-templates.json` for common patterns
