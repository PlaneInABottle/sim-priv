# Authentication

Trendyol uses **HTTP Basic Auth** for API authentication.

## HTTP Basic Auth

Encode `apiKey:apiSecret` as Base64 and send in the `Authorization` header.

> **⚠️ Sim Studio Note:** The `btoa()` function is **not available** in Sim's isolated-vm sandbox.
> Use the manual Base64 encoding helper shown below.

```js
// Manual Base64 encoder for Sim Studio isolated-vm (btoa is NOT available)
function base64Encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i);
    const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    output += chars[(a >> 2) & 63];
    output += chars[((a << 4) | (b >> 4)) & 63];
    output += i + 1 < str.length ? chars[((b << 2) | (c >> 6)) & 63] : '=';
    output += i + 2 < str.length ? chars[c & 63] : '=';
  }
  return output;
}

const credentials = base64Encode(apiKey + ':' + apiSecret);
const headers = {
  'Authorization': `Basic ${credentials}`,
  'Content-Type': 'application/json',
  'User-Agent': `${sellerId} - SelfIntegration`
};
```

## User-Agent Header (MANDATORY)

> **⚠️ WARNING:** All Trendyol API requests **MUST** include a `User-Agent` header.
> Requests without it will receive **HTTP 403 Forbidden** responses.

### Format

| Scenario | Format | Example |
|----------|--------|---------|
| Self-integration | `"{sellerId} - SelfIntegration"` | `"123456 - SelfIntegration"` |
| Integration partner | `"{sellerId} - {CompanyName}"` | `"123456 - MyIntegration"` |

### Rules

- The `{CompanyName}` portion must be **max 30 alphanumeric characters**
- No special characters other than hyphens/spaces
- `{sellerId}` is your numeric seller/supplier ID

### Example Headers

```js
// Complete required headers for every Trendyol API request
const headers = {
  'Authorization': `Basic ${credentials}`,
  'Content-Type': 'application/json',
  'User-Agent': `${sellerId} - SelfIntegration`  // MANDATORY — 403 without this
};
```

## Where to Get Credentials

1. Log in to the **Trendyol Seller Panel**
2. Navigate to **"Hesap Bilgileri"** (Account Information)
3. Go to **"Entegrasyon Bilgileri"** (Integration Information)
4. You will find:
   - **Seller ID** (`supplierId`) — your numeric seller ID
   - **API Key** — used as the username in Basic Auth
   - **API Secret Key** — used as the password in Basic Auth

> **⚠️ Important:** Credentials differ between **Production** and **Stage** environments.
> Make sure you use the correct set for the environment you are targeting.

## Credential Storage in Sim Studio

Store credentials as **workflow variables** and reference them using `<variable.varName>` syntax in block inputs or `{{variableName}}` in custom tool code:

| Variable Name | Type | Description |
|---------------|------|-------------|
| `TRENDYOL_SELLER_ID` | string | Your seller/supplier ID (numeric) |
| `TRENDYOL_API_KEY` | string | API Key (from Entegrasyon Bilgileri) |
| `TRENDYOL_API_SECRET` | string | API Secret Key (from Entegrasyon Bilgileri) |

In a Sim **Custom Tool** code block:
```js
const sellerId = '{{TRENDYOL_SELLER_ID}}';

// Manual Base64 encoder (btoa is NOT available in isolated-vm)
function base64Encode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  for (let i = 0; i < str.length; i += 3) {
    const a = str.charCodeAt(i);
    const b = i + 1 < str.length ? str.charCodeAt(i + 1) : 0;
    const c = i + 2 < str.length ? str.charCodeAt(i + 2) : 0;
    output += chars[(a >> 2) & 63];
    output += chars[((a << 4) | (b >> 4)) & 63];
    output += i + 1 < str.length ? chars[((b << 2) | (c >> 6)) & 63] : '=';
    output += i + 2 < str.length ? chars[c & 63] : '=';
  }
  return output;
}

const credentials = base64Encode('{{TRENDYOL_API_KEY}}' + ':' + '{{TRENDYOL_API_SECRET}}');
```

## Seller ID Requirement

**`supplierId` is MANDATORY** for all API calls. It is embedded in the URL path as `{sellerId}`. This is the numeric ID assigned to your seller account in Trendyol's system.

## Key Notes

- **Auth is per-request** — no session/token caching needed (unlike OAuth flows)
- Basic Auth is the only officially documented authentication method
- Always include the `User-Agent` header — omitting it causes 403 errors
- Trendyol calls the credentials **"API Key"** and **"API Secret Key"** (not username/password)
