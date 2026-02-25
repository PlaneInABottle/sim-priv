# Authentication

Trendyol supports **two** authentication methods. Choose one per request.

## Method A: HTTP Basic Auth (Recommended)

Encode `username:password` as Base64 and send in the `Authorization` header.

```js
const credentials = btoa(`${username}:${password}`);
const headers = {
  'Authorization': `Basic ${credentials}`,
  'Content-Type': 'application/json'
};
```

## Method B: API Key

Send the API key in the `x-api-key` header.

```js
const headers = {
  'x-api-key': 'your-api-key-here',
  'Content-Type': 'application/json'
};
```

## Credential Storage in Sim Studio

Store credentials as **workflow variables** and reference them using `{{variableName}}` syntax:

| Variable Name | Type | Description |
|---------------|------|-------------|
| `TRENDYOL_SELLER_ID` | string | Your seller/supplier ID (numeric) |
| `TRENDYOL_API_USER` | string | API username |
| `TRENDYOL_API_PASS` | string | API password |
| `TRENDYOL_API_KEY` | string | API key (if using API Key auth) |

In a Sim **Function** block or **Custom Tool**:
```js
const sellerId = '{{TRENDYOL_SELLER_ID}}';
const credentials = btoa('{{TRENDYOL_API_USER}}' + ':' + '{{TRENDYOL_API_PASS}}');
```

## Seller ID Requirement

**`supplierId` is MANDATORY** for all API calls. It is embedded in the URL path as `{sellerId}`. This is the numeric ID assigned to your seller account in Trendyol's system.

## Key Notes

- **Auth is per-request** — no session/token caching needed (unlike OAuth flows)
- Basic Auth is the recommended method for API integrations
- API Key method is an alternative when Basic Auth is not suitable
