# BYOK (Bring Your Own Key) Setup

Configure and manage your own API keys for LLM providers.

## Overview

BYOK allows you to use your own API keys instead of platform-provided keys:
- **Use your own quotas and rate limits**
- **Keep billing on your accounts**
- **Works in both hosted and self-hosted**

## Supported Providers

| Provider | Provider ID | Key Format | Used For |
|----------|-------------|------------|----------|
| OpenAI | `openai` | `sk-...` | LLM calls, embeddings |
| Anthropic | `anthropic` | `sk-ant-...` | LLM calls (Claude) |
| Google | `google` | API key | LLM calls (Gemini) |
| Mistral | `mistral` | API key | LLM calls, OCR |

## Configuration Steps

### Via UI (Recommended)
1. Open workspace settings
2. Navigate to "API Keys" or "BYOK" section
3. Click "Add Key" for desired provider
4. Enter your API key
5. Key is encrypted and saved

### Key Priority
When executing a workflow, keys are resolved in order:
1. **Block-level key**: If a key is provided directly in the block
2. **BYOK workspace key**: Encrypted key from workspace settings
3. **Platform key** (hosted only): With configurable cost multiplier

## Provider-Specific Setup

### OpenAI
1. Get API key from [OpenAI Platform](https://platform.openai.com/api-keys)
2. Key format: `sk-...` or `sk-proj-...`
3. Ensure sufficient credits/billing configured
4. Used for: GPT models, text-embedding-ada-002

```bash
# Verify key works
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer sk-your-key"
```

### Anthropic
1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Key format: `sk-ant-...`
3. Used for: Claude models

```bash
# Verify key works
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: sk-ant-your-key" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-3-haiku-20240307","max_tokens":10,"messages":[{"role":"user","content":"Hi"}]}'
```

### Google (Gemini)
1. Get API key from [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Or use Google Cloud API credentials
3. Used for: Gemini models

```bash
# Verify key works
curl "https://generativelanguage.googleapis.com/v1/models?key=YOUR_KEY"
```

### Mistral
1. Get API key from [Mistral Console](https://console.mistral.ai/)
2. Used for: Mistral models, OCR in knowledge bases

```bash
# Verify key works
curl https://api.mistral.ai/v1/models \
  -H "Authorization: Bearer your-key"
```

## Key Storage Security

### Encryption
- Keys encrypted using AES-256-GCM
- Encryption key from `ENCRYPTION_KEY` env var
- Keys never stored in plaintext

### Database Schema
```sql
-- workspaceBYOKKeys table
CREATE TABLE workspace_byok_keys (
  id TEXT PRIMARY KEY,
  workspace_id TEXT REFERENCES workspaces(id),
  provider_id VARCHAR(50),  -- 'openai', 'anthropic', etc.
  encrypted_api_key TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  UNIQUE(workspace_id, provider_id)
);
```

### Access Pattern
```typescript
// Retrieve and decrypt BYOK key
const byokResult = await getBYOKKey(workspaceId, 'openai')
if (byokResult) {
  // Use byokResult.apiKey (decrypted)
}
```

## Key Rotation

### Manual Rotation
1. Generate new key from provider console
2. Update key in Sim workspace settings
3. Old key automatically replaced
4. Revoke old key from provider console

### Best Practices
- Rotate keys every 90 days
- Use separate keys per environment
- Monitor usage for anomalies
- Set up billing alerts with providers

## Troubleshooting

### "API key is required" Error
- BYOK key not configured for provider
- Check workspace settings
- Verify provider ID matches

### "Invalid API key" Error
- Key may be expired or revoked
- Verify key format matches provider
- Test key directly with provider API

### Key Not Being Used
Check priority order:
1. Is a key hardcoded in the block?
2. Is the workspace ID correct?
3. Is the provider ID correct (`openai` not `OpenAI`)?

### Decryption Failures
- `ENCRYPTION_KEY` may have changed
- Re-enter the API key in settings
- Check logs for encryption errors

## Self-Hosted Configuration

For self-hosted deployments without BYOK:
```bash
# Set keys directly in environment
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_AI_API_KEY=...
MISTRAL_API_KEY=...
```

These become the default keys when no BYOK is configured.

## Code Reference

### Getting API Key with BYOK Fallback
```typescript
import { getApiKeyWithBYOK } from '@/lib/api-key/byok'

const { apiKey, isBYOK } = await getApiKeyWithBYOK(
  'openai',           // provider
  'gpt-4',            // model
  workspaceId,        // workspace ID
  userProvidedKey     // optional block-level key
)
// Returns appropriate key based on priority
```

### BYOK Key Retrieval
```typescript
import { getBYOKKey } from '@/lib/api-key/byok'

const result = await getBYOKKey(workspaceId, 'anthropic')
if (result) {
  // result.apiKey - decrypted key
  // result.isBYOK - always true
}
```
