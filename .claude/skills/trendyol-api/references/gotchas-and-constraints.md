# Gotchas & Constraints

Critical pitfalls, limitations, and regional considerations for the Trendyol Customer Questions API.

## Critical Gotchas

### 1. Timestamps are Unix Milliseconds
- All timestamps (`creationDate`, `startDate`, `endDate`, `rejectedDate`, `reportedDate`) are **13-digit Unix milliseconds** (e.g., `1700000000000`)
- **NOT** seconds (10-digit)
- Using seconds will result in dates far in the past

### 2. Supplier ID is Mandatory
- `supplierId` is **mandatory** in the URL path — every request must include it
- It appears as `{sellerId}` in the path: `/integration/qna/sellers/{sellerId}/...`

### 3. Pages are 0-Indexed
- First page = `page=0` (not `page=1`)
- Using `page=1` will skip the first page of results

### 4. Maximum Page Size is 50
- `size` parameter max value is **50**
- Larger values will be rejected or clamped

### 5. Date Range Cannot Exceed 2 Weeks
- When using `startDate`/`endDate`, the range must be ≤ 14 days
- The API will return an error or no data if the range exceeds this

### 6. No Date Params = Last 7 Days Only
- If you omit `startDate` and `endDate`, the API only returns questions from the **last 7 days**
- You may miss older unanswered questions

### 7. Reporting Questions is UI-Only
- Reporting questions (`REPORTED` status) is only possible via the **Trendyol Seller Panel** (web UI)
- There is no API endpoint to report questions

### 8. Answer Moderation Delay
- Answer moderation is **not instant** — there is a delay before answers appear on trendyol.com
- Status moves to `WAITING_FOR_APPROVE` immediately, but `ANSWERED` status comes later

### 9. ProductMainId vs Product ID
- `productMainId` is the **seller's SKU/model code**, not Trendyol's internal product ID
- Do not confuse it with Trendyol's product identifiers

### 10. Auth is Per-Request
- **No session/token caching needed** (unlike OAuth flows)
- Each request carries its own Basic Auth or API Key header

### 11. No Webhooks for Q&A
- Trendyol **does NOT** support webhooks for customer questions
- Webhooks are only available for **order status events**
- Questions must be retrieved via **polling** (scheduled GET requests)

### 12. Re-answering Rejected Questions
- Rejected questions can be re-answered by POSTing a new answer to the same question ID
- The previous rejected answer remains in the `rejectedAnswer` field
- The new answer goes back to `WAITING_FOR_APPROVE`

### 13. Rate Limiting (50 Requests per 10 Seconds)
- Trendyol enforces a rate limit of **50 requests per endpoint per 10 seconds**
- Exceeding this limit returns **HTTP 429 (Too Many Requests)**
- Recommendation: Use a **minimum 3-minute polling interval** for scheduled workflows
- Implement **exponential backoff** on 429 responses (see [Polling Strategy](polling-strategy.md))

### 14. User-Agent Header is Mandatory
- All API requests **MUST** include a `User-Agent` header
- Format: `"{sellerId} - {IntegrationCompanyName}"` (e.g., `"123456 - SelfIntegration"`)
- Missing `User-Agent` results in **HTTP 403 Forbidden**
- See [Authentication](authentication.md) for details

### 15. Sim Studio Isolated-VM Execution Constraints
- Sim custom tool code runs in an **isolated-vm sandbox** with limited globals
- The following standard JavaScript APIs are **NOT available**:
  - `btoa()` / `atob()` — use manual Base64 encoding (see [Authentication](authentication.md))
  - `URLSearchParams` — use manual query string building
  - `URL` — construct URL strings manually
  - `Buffer` — not available in the sandbox
  - `crypto` — not available in the sandbox
  - `require()` / `import` — no module system
- **Available globals**: `fetch`, `console`, `setTimeout`, `sleep`, `JSON`, `Math`, `Date`, `encodeURIComponent`, `decodeURIComponent`
- All custom tool code examples in this skill use manual implementations compatible with isolated-vm

## Regional Considerations

- The API serves the **Turkish marketplace** (trendyol.com)
- Customer questions are typically in **Turkish**
- Answer content should be in **Turkish** for proper moderation
- Product names and descriptions are in Turkish
- Currency references are in **TRY** (Turkish Lira)

## API Limitations Summary

| Limitation | Value |
|------------|-------|
| Max page size | 50 |
| Max date range | 14 days (2 weeks) |
| Default date range (no params) | 7 days |
| Answer min length | 10 characters |
| Answer max length | 2,000 characters |
| Rate limit | 50 requests per endpoint per 10 seconds |
| Rate limit response | HTTP 429 Too Many Requests |
| Recommended poll interval | ≥ 3 minutes |
| User-Agent header | **Mandatory** (403 without it) |
| Webhook support | ❌ Not available for Q&A |
| Report via API | ❌ Seller Panel only |
| Timestamp format | Unix milliseconds (13-digit) |
| Page indexing | 0-based |
| `btoa()` in Sim custom tools | ❌ Not available (use manual Base64) |
| `URLSearchParams` in Sim | ❌ Not available (use manual query string) |
