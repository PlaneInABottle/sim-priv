# API Reference

## Environments

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://apigw.trendyol.com` |
| **Stage** | `https://stageapigw.trendyol.com` |

## Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/integration/qna/sellers/{sellerId}/questions/filter` | List/filter customer questions with pagination |
| **GET** | `/integration/qna/sellers/{sellerId}/questions/{id}` | Get a single question by its ID |
| **POST** | `/integration/qna/sellers/{sellerId}/questions/{id}/answers` | Submit an answer to a specific question |

---

## 1. List/Filter Customer Questions

### Endpoint

```
GET https://apigw.trendyol.com/integration/qna/sellers/{sellerId}/questions/filter
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sellerId` | long | **Yes** | Seller/supplier ID |

### Query Parameters

See [Parameters Reference](parameters.md) for the complete parameter table.

### Response Structure

```json
{
  "content": [
    {
      "id": 12345678,
      "customerId": 9876543,
      "text": "Bu ürün su geçirmez mi?",
      "userName": "Müşteri Adı",
      "showUserName": true,
      "status": "WAITING_FOR_ANSWER",
      "public": true,
      "creationDate": 1700000000000,
      "productName": "Outdoor Ceket - Siyah",
      "productMainId": "SKU-12345",
      "imageUrl": "https://cdn.trendyol.com/...",
      "webUrl": "https://www.trendyol.com/...",
      "answeredDateMessage": null,
      "reason": null,
      "rejectedDate": null,
      "reportReason": null,
      "reportedDate": null,
      "answer": null,
      "rejectedAnswer": null
    }
  ],
  "page": 0,
  "size": 50,
  "totalElements": 864,
  "totalPages": 18
}
```

### Pagination Envelope Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | array | Array of question objects |
| `page` | int | Current page number (0-indexed) |
| `size` | int | Page size used in the request |
| `totalElements` | int | Total number of matching questions |
| `totalPages` | int | Total number of pages |

---

## 2. Get Single Question Detail

### Endpoint

```
GET https://apigw.trendyol.com/integration/qna/sellers/{sellerId}/questions/{id}
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sellerId` | long | **Yes** | Seller/supplier ID |
| `id` | long | **Yes** | Question ID (from the filter response `content[].id`) |

### Response

Returns the full question object (same shape as a single item in the `content` array from the filter endpoint). See [Data Models](data-models.md) for the complete Question schema.

---

## 3. Answer a Customer Question

### Endpoint

```
POST https://apigw.trendyol.com/integration/qna/sellers/{sellerId}/questions/{id}/answers
```

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sellerId` | long | **Yes** | Seller/supplier ID |
| `id` | long | **Yes** | Question ID to answer |

### Request Body

```json
{
  "text": "Evet, ürünümüz su geçirmez özelliğe sahiptir. IPX4 sertifikası bulunmaktadır."
}
```

### Validation Rules

| Rule | Constraint |
|------|-----------|
| **Minimum length** | 10 characters |
| **Maximum length** | 2,000 characters |
| **Required fields** | `text` (string) |

### Response

```
HTTP 200 (Success — no response body)
```

### Important Notes

- After submitting an answer, the question status moves to `WAITING_FOR_APPROVE`
- Trendyol moderates answers before publishing them on trendyol.com
- If rejected, the question moves to `REJECTED` status with a `rejectedAnswer` object containing the rejection reason
- You can re-answer rejected questions by POSTing a new answer

---

## Error Responses

All endpoints may return the following error HTTP status codes:

| Status | Meaning | Common Cause | Action |
|--------|---------|--------------|--------|
| **400** | Bad Request | Invalid parameters, validation failure (e.g., answer too short/long) | Check request body and query parameters |
| **401** | Unauthorized | Invalid or missing API Key / API Secret in Basic Auth header | Verify credentials from Seller Panel → Entegrasyon Bilgileri |
| **403** | Forbidden | Missing `User-Agent` header, or incorrect seller ID / permissions | Add `User-Agent` header (see [Authentication](authentication.md)); verify seller ID |
| **404** | Not Found | Invalid question ID or endpoint path | Verify the question ID exists and URL is correct |
| **429** | Too Many Requests | Rate limit exceeded (50 requests per endpoint per 10 seconds) | Implement exponential backoff; wait before retrying |
| **500+** | Server Error | Trendyol internal error | Retry with exponential backoff (see [Polling Strategy](polling-strategy.md)) |

---

## Question Lifecycle & Status Flow

```
Customer asks question on trendyol.com
    ↓
[WAITING_FOR_ANSWER]  ←── Seller polls this status
    ↓
Seller submits answer via API
    ↓
[WAITING_FOR_APPROVE]  ←── Trendyol moderation
    ↓
    ├── Approved → [ANSWERED]  (published on trendyol.com)
    │
    └── Rejected → [REJECTED]  (rejectedAnswer populated)
                       ↓
               Seller can re-answer → back to [WAITING_FOR_APPROVE]

(Separate flow)
Seller reports question via Trendyol Seller Panel
    ↓
[REPORTED]  (reportReason populated)
```
