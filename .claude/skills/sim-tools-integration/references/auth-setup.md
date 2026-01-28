# Authentication Setup

Guide for configuring authentication for each tool provider.

## OAuth Providers

OAuth providers require user authorization through a consent flow. Sim handles token refresh automatically.

### Google Services
**Services:** Gmail, Google Drive, Google Docs, Google Sheets, Google Calendar, Google Forms

**Setup:**
1. Navigate to Settings → Integrations
2. Click "Connect" next to Google
3. Select the specific service (Gmail, Drive, etc.)
4. Authorize requested scopes
5. Token is stored and refreshed automatically

**Scopes by Service:**
| Service | Scopes |
|---------|--------|
| Gmail | `gmail.send`, `gmail.modify`, `gmail.labels` |
| Drive | `drive.file`, `drive` |
| Calendar | `calendar.events`, `calendar.readonly` |
| Sheets | `spreadsheets`, `drive.file` |

### Slack
**Setup:**
1. Settings → Integrations → Slack
2. Click "Add to Slack"
3. Select workspace and authorize

**Required Scopes:** `chat:write`, `channels:read`, `users:read`, `files:read`

### Discord
**Setup:**
1. Settings → Integrations → Discord
2. Authorize bot to your server
3. Configure channel permissions

**Bot Permissions:** Send Messages, Read Messages, Manage Messages, Add Reactions

### Microsoft Services
**Services:** Teams, Outlook, OneDrive, SharePoint, Excel, Planner

**Setup:**
1. Settings → Integrations → Microsoft
2. Sign in with Microsoft account
3. Select specific service to authorize

### Linear
**Setup:**
1. Settings → Integrations → Linear
2. Click "Connect Linear"
3. Authorize your Linear workspace

### GitHub/GitLab
**Setup:**
1. Settings → Integrations → GitHub/GitLab
2. Authorize Sim app
3. Select repositories to grant access

## API Key Providers

API key providers require manual key entry.

### AWS Services (S3, DynamoDB, SQS)
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "AWS"
3. Enter:
   - Access Key ID
   - Secret Access Key
   - Region

**Best Practice:** Use IAM role with minimal permissions

### Twilio
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "Twilio"
3. Enter:
   - Account SID
   - Auth Token
   - From Phone Number

### OpenAI
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "OpenAI"
3. Enter API Key

### Stripe
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "Stripe"
3. Enter Secret Key (use test key for development)

### SendGrid / Resend
**Setup:**
1. Settings → Credentials → Add Credential
2. Select provider
3. Enter API Key

## Database Connections

### PostgreSQL
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "PostgreSQL"
3. Enter connection string or individual fields:
   - Host
   - Port (default: 5432)
   - Database
   - Username
   - Password
   - SSL Mode

**Connection String Format:**
```
postgresql://user:password@host:port/database?sslmode=require
```

### MongoDB
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "MongoDB"
3. Enter connection string:
```
mongodb+srv://user:password@cluster.mongodb.net/database
```

### MySQL
**Setup:**
1. Settings → Credentials → Add Credential
2. Select "MySQL"
3. Enter connection details

## Credential Management

### Environment Variables
For self-hosted deployments, credentials can be set via environment:

```bash
# AWS
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1

# OpenAI
OPENAI_API_KEY=sk-xxx

# Database
DATABASE_URL=postgresql://...
```

### Workspace-Level Credentials
Credentials are scoped to workspaces:
- Each workspace can have its own credentials
- Team members share workspace credentials
- Personal credentials are user-specific

### Security Best Practices
1. **Rotate keys regularly** - Update API keys periodically
2. **Use least privilege** - Grant minimal required permissions
3. **Separate environments** - Use different credentials for dev/prod
4. **Audit access** - Review connected integrations periodically
5. **Revoke unused** - Disconnect integrations no longer needed

## Troubleshooting

### OAuth Token Expired
- Sim auto-refreshes tokens, but if refresh fails:
  1. Go to Settings → Integrations
  2. Disconnect the service
  3. Reconnect and re-authorize

### API Key Invalid
- Verify key is correct and active
- Check key has required permissions
- Ensure key isn't rate-limited or expired

### Connection Refused (Databases)
- Verify host is accessible from Sim servers
- Check firewall/security group rules
- Confirm SSL requirements match configuration
