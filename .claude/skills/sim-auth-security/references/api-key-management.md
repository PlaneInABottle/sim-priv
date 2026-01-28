# API Key Management

Best practices for managing Sim API keys, access control, and monitoring.

## API Key Types

### Workflow Execution Keys
Used to execute workflows via API:
```bash
curl -X POST \
  -H "X-API-Key: sim_live_xxxxx" \
  https://sim.ai/api/workflows/{workflowId}/execute
```

### Webhook Secret Tokens
Authenticate incoming webhooks:
```bash
curl -X POST \
  -H "Authorization: Bearer your-webhook-secret" \
  https://sim.ai/api/webhooks/{webhookPath}
```

## Key Generation

### Creating API Keys
1. Navigate to workspace settings
2. Go to "API Keys" section
3. Click "Create New Key"
4. Set name and optional expiration
5. Copy key immediately (shown once)

### Key Format
```
sim_live_xxxxxxxxxxxxxxxxxxxx  # Production key
sim_test_xxxxxxxxxxxxxxxxxxxx  # Test/sandbox key
```

## Storage Best Practices

### Environment Variables
```bash
# .env (never commit)
SIM_API_KEY=sim_live_xxxxx
SIM_WEBHOOK_SECRET=your-secret-token
```

### Secret Managers
Recommended for production:
- AWS Secrets Manager
- Google Secret Manager
- HashiCorp Vault
- Azure Key Vault

### Kubernetes Secrets
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sim-credentials
type: Opaque
stringData:
  api-key: sim_live_xxxxx
```

## Access Control

### Key Permissions
Define what each key can access:
- **Workflow execution**: Run specific workflows
- **Read-only**: View workflow status, logs
- **Admin**: Full workspace access

### IP Allowlisting
Restrict key usage to specific IPs:
```json
{
  "keyId": "key_xxxxx",
  "allowedIps": ["192.168.1.0/24", "10.0.0.0/8"]
}
```

### Rate Limits
Per-key rate limiting:
- Default: 1000 requests/minute
- Can be configured per key
- Exceeding limits returns 429

## Key Rotation

### Rotation Strategy
1. Generate new key
2. Update applications with new key
3. Verify new key works
4. Disable old key
5. Delete old key after grace period

### Zero-Downtime Rotation
```bash
# 1. Create new key
NEW_KEY=$(sim api-keys create --name "rotation-$(date +%Y%m%d)")

# 2. Deploy with both keys (if supported)
# 3. Verify new key
curl -H "X-API-Key: $NEW_KEY" https://sim.ai/api/health

# 4. Remove old key from deployment
# 5. Revoke old key
sim api-keys revoke $OLD_KEY_ID
```

### Rotation Schedule
| Environment | Rotation Frequency |
|-------------|-------------------|
| Production | Every 90 days |
| Staging | Every 30 days |
| Development | As needed |

## Expiration Policies

### Setting Expiration
```javascript
// Create key with 90-day expiration
const key = await createApiKey({
  name: 'ci-pipeline-key',
  expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
})
```

### Expiration Notifications
- Email alerts 7 days before expiration
- Webhook notifications available
- Dashboard warnings

## Audit Logging

### Logged Events
- Key creation
- Key usage (API calls)
- Key rotation
- Key revocation
- Permission changes

### Log Format
```json
{
  "timestamp": "2024-01-15T10:30:00Z",
  "event": "api_key_used",
  "keyId": "key_xxxxx",
  "workflowId": "wf_yyyyy",
  "ip": "192.168.1.100",
  "userAgent": "curl/7.79.1",
  "responseStatus": 200,
  "executionTime": 1234
}
```

### Monitoring Queries
```sql
-- Keys with unusual activity
SELECT key_id, COUNT(*) as requests
FROM api_logs
WHERE timestamp > NOW() - INTERVAL '1 hour'
GROUP BY key_id
HAVING COUNT(*) > 1000;

-- Failed authentication attempts
SELECT ip, COUNT(*) as failures
FROM api_logs
WHERE status = 401
GROUP BY ip
ORDER BY failures DESC;
```

## Webhook Authentication

### Token-Based Auth
```javascript
// Configure webhook trigger
{
  type: 'generic_webhook',
  data: {
    requireAuth: true,
    token: 'your-secret-token',
    secretHeaderName: 'X-Webhook-Secret'
  }
}
```

### Request Validation
```bash
# Bearer token
curl -H "Authorization: Bearer your-secret-token" ...

# Custom header
curl -H "X-Webhook-Secret: your-secret-token" ...
```

### Signature Verification
For providers that sign webhooks:
```typescript
// Verify webhook signature
const isValid = verifySignature(
  payload,
  headers['x-signature'],
  webhookSecret
)
```

## Security Checklist

### Key Creation
- [ ] Use descriptive names
- [ ] Set appropriate expiration
- [ ] Document key purpose
- [ ] Limit permissions

### Key Storage
- [ ] Never commit to version control
- [ ] Use secret manager in production
- [ ] Encrypt at rest
- [ ] Limit access to secrets

### Key Lifecycle
- [ ] Rotate regularly
- [ ] Revoke unused keys
- [ ] Monitor for anomalies
- [ ] Maintain audit trail

### Incident Response
- [ ] Document revocation procedure
- [ ] Know how to rotate quickly
- [ ] Have backup access method
- [ ] Test recovery process

## Troubleshooting

### "Invalid API key"
- Verify key hasn't expired
- Check for typos
- Ensure correct header name (`X-API-Key`)

### "Rate limit exceeded"
- Check current limits
- Implement backoff
- Request limit increase if needed

### "Unauthorized" on webhook
- Verify token matches exactly
- Check header name
- Ensure `requireAuth: true`

### Key compromised
1. Revoke immediately
2. Generate new key
3. Update all applications
4. Review audit logs
5. Investigate breach
