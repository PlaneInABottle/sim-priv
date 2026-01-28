# OAuth Integration

Comprehensive guide for OAuth provider setup, token management, and service integration.

## Supported Providers

### Google Services
| Service | Provider ID | Key Scopes |
|---------|-------------|------------|
| Gmail | `google-email` | https://www.googleapis.com/auth/gmail.send, https://www.googleapis.com/auth/gmail.modify, https://www.googleapis.com/auth/gmail.labels |
| Google Drive | `google-drive` | https://www.googleapis.com/auth/drive.file, https://www.googleapis.com/auth/drive |
| Google Docs | `google-docs` | https://www.googleapis.com/auth/drive.file, https://www.googleapis.com/auth/drive |
| Google Sheets | `google-sheets` | https://www.googleapis.com/auth/drive.file, https://www.googleapis.com/auth/drive |
| Google Calendar | `google-calendar` | https://www.googleapis.com/auth/calendar |
| Google Forms | `google-forms` | https://www.googleapis.com/auth/forms.responses.readonly |
| Google Groups | `google-groups` | https://www.googleapis.com/auth/admin.directory.group |
| Google Slides | `google-slides` | https://www.googleapis.com/auth/presentations |
| Google Vault | `google-vault` | https://www.googleapis.com/auth/ediscovery |
| Vertex AI | `vertex-ai` | https://www.googleapis.com/auth/cloud-platform |

### Microsoft Services
| Service | Provider ID | Key Scopes |
|---------|-------------|------------|
| Excel | `microsoft-excel` | Files.ReadWrite |
| Teams | `microsoft-teams` | Chat.ReadWrite, ChannelMessage.Send |
| Outlook | `microsoft-outlook` | Mail.ReadWrite |
| OneDrive | `microsoft-onedrive` | Files.ReadWrite.All |
| SharePoint | `microsoft-sharepoint` | Sites.ReadWrite.All |
| Planner | `microsoft-planner` | Tasks.ReadWrite |

### Other Providers
| Provider | Services |
|----------|----------|
| GitHub | Repository access, issues, PRs |
| Slack | Messaging, channels, users |
| LinkedIn | Posts, profiles |
| Notion | Pages, databases |
| Airtable | Bases, tables, records |
| Salesforce | CRM objects |
| HubSpot | Contacts, deals |

## OAuth Flow

### 1. Authorization Request
User clicks "Connect" → redirected to provider:
```
GET https://accounts.google.com/o/oauth2/v2/auth
  ?client_id={CLIENT_ID}
  &redirect_uri={CALLBACK_URL}
  &scope={SCOPES}
  &response_type=code
  &access_type=offline
  &prompt=consent
  &state={STATE}
```

### 2. Callback Handler
Provider redirects back with authorization code:
```
GET /api/auth/oauth/callback
  ?code={AUTH_CODE}
  &state={STATE}
```

### 3. Token Exchange
Backend exchanges code for tokens:
```typescript
const tokens = await exchangeCodeForTokens(code)
// Returns: access_token, refresh_token, expires_in
```

### 4. Token Storage
Tokens encrypted and stored per user/service.

## Provider Setup

### Google
1. Create project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable required APIs (Gmail API, Drive API, etc.)
3. Configure OAuth consent screen
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   ```
   https://your-domain.com/api/auth/oauth/callback/google
   ```
6. Set environment variables:
   ```bash
   AUTH_GOOGLE_ID=your-client-id
   AUTH_GOOGLE_SECRET=your-client-secret
   ```

### Microsoft
1. Register app in [Azure Portal](https://portal.azure.com)
2. Configure platform (Web)
3. Add redirect URI:
   ```
   https://your-domain.com/api/auth/oauth/callback/microsoft
   ```
4. Create client secret
5. Set environment variables:
   ```bash
   AUTH_MICROSOFT_ENTRA_ID_ID=your-client-id
   AUTH_MICROSOFT_ENTRA_ID_SECRET=your-client-secret
   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=common  # or specific tenant
   ```

### GitHub
1. Create OAuth App in [GitHub Settings](https://github.com/settings/developers)
2. Set callback URL:
   ```
   https://your-domain.com/api/auth/oauth/callback/github
   ```
3. Set environment variables:
   ```bash
   AUTH_GITHUB_ID=your-client-id
   AUTH_GITHUB_SECRET=your-client-secret
   ```

### Slack
1. Create app at [Slack API](https://api.slack.com/apps)
2. Enable OAuth & Permissions
3. Add redirect URL and required scopes
4. Set environment variables:
   ```bash
   AUTH_SLACK_ID=your-client-id
   AUTH_SLACK_SECRET=your-client-secret
   ```

## Token Management

### Automatic Refresh
The system automatically refreshes tokens before expiration:
```typescript
// Token refresh happens transparently
const token = await getValidToken(userId, providerId)
// Returns valid access token (refreshed if needed)
```

### Manual Reauthorization
Required when:
- User revokes access
- Scopes change
- Refresh token expires (rare)

### Token Storage
```typescript
// Tokens stored encrypted in database
{
  userId: string
  providerId: string
  accessToken: encrypted
  refreshToken: encrypted
  expiresAt: timestamp
  scopes: string[]
}
```

## Scopes and Permissions

### Minimal Scope Principle
Request only scopes needed for specific functionality:
```typescript
// Good: Specific scopes
scopes: ['https://www.googleapis.com/auth/gmail.send', 'https://www.googleapis.com/auth/gmail.labels']

// Avoid: Overly broad
scopes: ['https://mail.google.com/']
```

> **Note:** Scope formats vary by provider. Google uses full URLs (e.g., `https://www.googleapis.com/auth/gmail.send`) while Microsoft uses short names (e.g., `Mail.ReadWrite`). The system normalizes these formats internally.

### Incremental Authorization
Request additional scopes when needed:
```typescript
// Initial connection
scopes: ['gmail.readonly']

// Later, if send needed
scopes: ['gmail.readonly', 'gmail.send']
```

### Scope Verification
Check granted scopes before using features:
```typescript
const hasScope = await verifyScope(userId, 'google-email', 'gmail.send')
if (!hasScope) {
  // Prompt for reauthorization
}
```

## Using OAuth in Workflows

### OAuth Subblock
Blocks requiring OAuth have an OAuth subblock:
```javascript
{
  type: 'gmail',
  subBlocks: {
    oauth: {
      type: 'oauth',
      provider: 'google',
      serviceId: 'gmail'
    }
  }
}
```

### Accessing OAuth Data
In block execution:
```typescript
// OAuth token automatically injected
const credential = context.credentials['google-email']
const accessToken = credential.accessToken

// Use with API calls
await fetch('https://gmail.googleapis.com/...', {
  headers: { Authorization: `Bearer ${accessToken}` }
})
```

## Troubleshooting

### "Token expired" Errors
- Check if refresh token is valid
- Verify user hasn't revoked access
- Ensure offline_access scope was granted

### "Insufficient permissions"
- Compare required vs granted scopes
- Trigger reauthorization with additional scopes

### "Invalid redirect URI"
- Ensure exact match in provider config
- Check for trailing slashes
- Verify HTTPS in production

### Rate Limit from Provider
- Implement exponential backoff
- Check provider-specific limits
- Consider batching requests
