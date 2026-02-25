# Query Parameters

Complete parameter reference for the Trendyol Customer Questions filter endpoint.

## Filter Endpoint Parameters

```
GET /integration/qna/sellers/{sellerId}/questions/filter
```

| Parameter | Type | Required | Constraints | Description |
|-----------|------|----------|-------------|-------------|
| `supplierId` | long | **Yes** | — | Seller/supplier ID (same as `{sellerId}` in path) |
| `barcode` | long | No | — | Filter questions for a specific product barcode |
| `page` | int | No | 0-indexed | Page number to return (default: 0) |
| `size` | int | No | Max **50** | Number of results per page (default varies, max 50) |
| `startDate` | long | No | Timestamp (ms) | Return questions created after this date |
| `endDate` | long | No | Timestamp (ms) | Return questions created before this date |
| `status` | string | No | See status values | Filter by question status |
| `orderByField` | string | No | `CreatedDate` or `LastModifiedDate` | Field to sort by |
| `orderByDirection` | string | No | `ASC` or `DESC` | Sort direction |

## Status Values

| Status | Description |
|--------|-------------|
| `WAITING_FOR_ANSWER` | New question, awaiting seller response |
| `WAITING_FOR_APPROVE` | Answer submitted, pending Trendyol review/approval |
| `ANSWERED` | Answer approved and published on trendyol.com |
| `REPORTED` | Question reported by the seller (via Trendyol Seller Panel only) |
| `REJECTED` | Answer was rejected by Trendyol moderation |

## Date Range Constraints

- **No date params:** Returns questions from the **last 7 days** (default)
- **With date params:** Maximum range is **2 weeks** (14 days)
- **Format:** Unix timestamp in **milliseconds** (e.g., `1700000000000`)

```js
// Example: last 3 days
const endDate = Date.now();
const startDate = endDate - (3 * 24 * 60 * 60 * 1000);
// Use: ?startDate=${startDate}&endDate=${endDate}
```

## Sorting Options

### `orderByField` values

| Value | Description |
|-------|-------------|
| `CreatedDate` | Sort by when the question was asked |
| `LastModifiedDate` | Sort by last change (useful for change-based polling) |

### `orderByDirection` values

| Value | Description |
|-------|-------------|
| `ASC` | Ascending (oldest first) |
| `DESC` | Descending (newest first) |

## Status Filtering for Efficient Polling

- **Always** filter by `status=WAITING_FOR_ANSWER` for actionable questions
- To monitor rejected answers, also poll for `status=REJECTED`
- Use `orderByField=LastModifiedDate` for change-based polling
- Use `orderByField=CreatedDate` for new-question-based polling
