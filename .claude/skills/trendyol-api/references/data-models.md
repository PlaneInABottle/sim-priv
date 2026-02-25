# Data Models

Complete JSON schemas and field descriptions for all Trendyol Customer Questions API objects.

## Question Object

The main data model returned by the filter and detail endpoints.

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Unique question ID |
| `customerId` | long | Customer's trendyol.com registered ID |
| `text` | string | The question text asked by the customer |
| `userName` | string | Customer's display name |
| `showUserName` | boolean | Whether the customer's name is shown on trendyol.com |
| `status` | string | Question status (see [Parameters — Status Values](parameters.md#status-values)) |
| `public` | boolean | Whether the question is publicly visible on trendyol.com |
| `creationDate` | long | Timestamp (ms) when the customer asked the question |
| `productName` | string | Name of the product the question is about |
| `productMainId` | string | Product's main ID / model code (seller's SKU reference) |
| `imageUrl` | string | Product image URL |
| `webUrl` | string | Product page URL on trendyol.com |
| `answeredDateMessage` | string\|null | Human-readable answer timing message |
| `reason` | string\|null | Rejection reason (if question was rejected) |
| `rejectedDate` | long\|null | Timestamp (ms) when the question was rejected |
| `reportReason` | string\|null | Seller's report reason (only set via Trendyol Seller Panel) |
| `reportedDate` | long\|null | Timestamp (ms) when the question was reported |
| `answer` | object\|null | The approved answer object (if answered) |
| `rejectedAnswer` | object\|null | The most recently rejected answer (if any) |

### Example Question JSON

```json
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
```

---

## Answer Object

Nested in `question.answer` when a question has been answered and approved.

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Answer ID |
| `text` | string | Answer text content |
| `creationDate` | long | Timestamp (ms) when the answer was submitted |
| `hasPrivateInfo` | boolean | Whether the answer contains private/personal information |
| `reason` | string\|null | Additional context or reason |

---

## Rejected Answer Object

Nested in `question.rejectedAnswer` when an answer has been rejected by Trendyol moderation.

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Rejected answer ID |
| `text` | string | The answer text that was rejected |
| `creationDate` | long | Timestamp (ms) when the rejected answer was created |
| `reason` | string | Reason the answer was rejected by Trendyol moderation |

---

## Pagination Envelope

Wraps the `content` array in list/filter responses.

| Field | Type | Description |
|-------|------|-------------|
| `content` | array | Array of question objects for this page |
| `page` | int | Current page number (0-indexed) |
| `size` | int | Page size |
| `totalElements` | int | Total matching records across all pages |
| `totalPages` | int | Total number of pages |

### Example Pagination Envelope

```json
{
  "content": [ /* ...question objects... */ ],
  "page": 0,
  "size": 50,
  "totalElements": 864,
  "totalPages": 18
}
```
