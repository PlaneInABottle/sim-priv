---
name: trendyol-api
description: Complete guide for Trendyol Customer Questions API integration in Sim Studio workflows. Covers fetching customer questions via polling, answering questions, authentication, data models, and scheduling strategies.
---

# Trendyol Customer Questions API

## Quick Start

**Base URL (Production):** `https://apigw.trendyol.com/integration/qna/sellers/{sellerId}`
**Base URL (Stage):** `https://stageapigw.trendyol.com/integration/qna/sellers/{sellerId}`
**Protocol:** REST (JSON)
**Auth:** HTTP Basic Auth OR API Key header

> **Important:** Trendyol does NOT support webhooks for customer questions. Questions must be retrieved via **polling** (scheduled GET requests). Webhooks are only available for order status events.

```js
// Quick example: fetch unanswered questions
const sellerId = '123456';
const credentials = btoa('username:password');

const res = await fetch(
  `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?status=WAITING_FOR_ANSWER&size=50&page=0`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
  }
);
const data = await res.json();
// data.content = array of question objects
// data.totalElements = total matching questions
```

---

## 1. Authentication

Trendyol supports **two** authentication methods. Choose one per request.

### Method A: HTTP Basic Auth (Recommended)

Encode `username:password` as Base64 and send in the `Authorization` header.

```js
const credentials = btoa(`${username}:${password}`);
const headers = {
  'Authorization': `Basic ${credentials}`,
  'Content-Type': 'application/json'
};
```

### Method B: API Key

Send the API key in the `x-api-key` header.

```js
const headers = {
  'x-api-key': 'your-api-key-here',
  'Content-Type': 'application/json'
};
```

### Credential Storage in Sim Studio

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

### Seller ID Requirement

**`supplierId` is MANDATORY** for all API calls. It is embedded in the URL path as `{sellerId}`. This is the numeric ID assigned to your seller account in Trendyol's system.

---

## 2. API Endpoints — Reference Table

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `/integration/qna/sellers/{sellerId}/questions/filter` | List/filter customer questions with pagination |
| **GET** | `/integration/qna/sellers/{sellerId}/questions/{id}` | Get a single question by its ID |
| **POST** | `/integration/qna/sellers/{sellerId}/questions/{id}/answers` | Submit an answer to a specific question |

### Environments

| Environment | Base URL |
|-------------|----------|
| **Production** | `https://apigw.trendyol.com` |
| **Stage** | `https://stageapigw.trendyol.com` |

---

## 3. Fetching Customer Questions (Filter)

### Endpoint

```
GET https://apigw.trendyol.com/integration/qna/sellers/{sellerId}/questions/filter
```

### Query Parameters

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

### Status Values

| Status | Description |
|--------|-------------|
| `WAITING_FOR_ANSWER` | New question, awaiting seller response |
| `WAITING_FOR_APPROVE` | Answer submitted, pending Trendyol review/approval |
| `ANSWERED` | Answer approved and published on trendyol.com |
| `REPORTED` | Question reported by the seller (via Trendyol Seller Panel only) |
| `REJECTED` | Answer was rejected by Trendyol moderation |

### Date Range Constraints

- **No date params:** Returns questions from the **last 7 days** (default)
- **With date params:** Maximum range is **2 weeks** (14 days)
- **Format:** Unix timestamp in **milliseconds** (e.g., `1700000000000`)

```js
// Example: last 3 days
const endDate = Date.now();
const startDate = endDate - (3 * 24 * 60 * 60 * 1000);
// Use: ?startDate=${startDate}&endDate=${endDate}
```

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

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `content` | array | Array of question objects |
| `page` | int | Current page number (0-indexed) |
| `size` | int | Page size used in the request |
| `totalElements` | int | Total number of matching questions |
| `totalPages` | int | Total number of pages |

### Full Example — Fetch Unanswered Questions

```js
async function fetchUnansweredQuestions(sellerId, credentials, page = 0) {
  const params = new URLSearchParams({
    status: 'WAITING_FOR_ANSWER',
    size: '50',
    page: String(page),
    orderByField: 'CreatedDate',
    orderByDirection: 'DESC'
  });

  const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${params}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Trendyol API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Usage
const sellerId = '123456';
const credentials = btoa('myuser:mypass');
const result = await fetchUnansweredQuestions(sellerId, credentials);
console.log(`Found ${result.totalElements} unanswered questions`);

for (const q of result.content) {
  console.log(`[${q.id}] ${q.productName}: "${q.text}"`);
}
```

---

## 4. Fetching a Single Question Detail

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

Returns the full question object (same shape as a single item in the `content` array from the filter endpoint).

### Example

```js
async function getQuestionDetail(sellerId, questionId, credentials) {
  const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/${questionId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch question ${questionId}: ${response.status}`);
  }

  return await response.json();
}
```

---

## 5. Answering a Customer Question

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

### ⚠️ Important Notes

- After submitting an answer, the question status moves to `WAITING_FOR_APPROVE`
- Trendyol moderates answers before publishing them on trendyol.com
- If rejected, the question moves to `REJECTED` status with a `rejectedAnswer` object containing the rejection reason
- You can re-answer rejected questions by POSTing a new answer

### Full Example — Answer a Question

```js
async function answerQuestion(sellerId, questionId, answerText, credentials) {
  // Validate answer length
  if (!answerText || answerText.length < 10) {
    throw new Error('Answer must be at least 10 characters long');
  }
  if (answerText.length > 2000) {
    throw new Error('Answer must not exceed 2000 characters');
  }

  const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/${questionId}/answers`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ text: answerText })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Failed to answer question ${questionId}: ${response.status} — ${errorBody}`);
  }

  return { success: true, questionId, status: 'WAITING_FOR_APPROVE' };
}
```

---

## 6. Data Models

### Question Object

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Unique question ID |
| `customerId` | long | Customer's trendyol.com registered ID |
| `text` | string | The question text asked by the customer |
| `userName` | string | Customer's display name |
| `showUserName` | boolean | Whether the customer's name is shown on trendyol.com |
| `status` | string | Question status (see Status Values) |
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

### Answer Object (nested in `question.answer`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Answer ID |
| `text` | string | Answer text content |
| `creationDate` | long | Timestamp (ms) when the answer was submitted |
| `hasPrivateInfo` | boolean | Whether the answer contains private/personal information |
| `reason` | string\|null | Additional context or reason |

### Rejected Answer Object (nested in `question.rejectedAnswer`)

| Field | Type | Description |
|-------|------|-------------|
| `id` | long | Rejected answer ID |
| `text` | string | The answer text that was rejected |
| `creationDate` | long | Timestamp (ms) when the rejected answer was created |
| `reason` | string | Reason the answer was rejected by Trendyol moderation |

### Pagination Envelope

| Field | Type | Description |
|-------|------|-------------|
| `content` | array | Array of question objects for this page |
| `page` | int | Current page number (0-indexed) |
| `size` | int | Page size |
| `totalElements` | int | Total matching records across all pages |
| `totalPages` | int | Total number of pages |

---

## 7. Polling Strategy

Since webhooks are **not available** for customer questions, you must use **scheduled polling**.

### Recommended Poll Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Poll interval** | 3–5 minutes | Conservative; no documented rate limit but be respectful |
| **Status filter** | `WAITING_FOR_ANSWER` | Only fetch actionable questions |
| **Sort** | `orderByField=CreatedDate&orderByDirection=DESC` | Newest first |
| **Page size** | `50` (maximum) | Minimize request count |
| **Date range** | Last 24 hours or use `lastModifiedDate` tracking | Stay within 2-week max |

### State Tracking

Track the **last poll timestamp** or **highest question ID** to avoid reprocessing:

```js
// State tracking approach using lastModifiedDate
let lastPollTimestamp = Date.now() - (24 * 60 * 60 * 1000); // Start: 24h ago

async function pollNewQuestions(sellerId, credentials) {
  const params = new URLSearchParams({
    status: 'WAITING_FOR_ANSWER',
    startDate: String(lastPollTimestamp),
    endDate: String(Date.now()),
    size: '50',
    page: '0',
    orderByField: 'CreatedDate',
    orderByDirection: 'ASC'
  });

  const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${params}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json'
    }
  });

  const data = await response.json();

  if (data.content && data.content.length > 0) {
    // Update watermark to latest question's creation date + 1ms
    const latestDate = Math.max(...data.content.map(q => q.creationDate));
    lastPollTimestamp = latestDate + 1;
  }

  return data;
}
```

### Handling Pagination in Polls

If `totalPages > 1`, iterate through all pages:

```js
async function fetchAllPages(sellerId, credentials, baseParams) {
  const allQuestions = [];
  let page = 0;
  let totalPages = 1;

  do {
    const params = new URLSearchParams({ ...baseParams, page: String(page), size: '50' });
    const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${params}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    allQuestions.push(...data.content);
    totalPages = data.totalPages;
    page++;
  } while (page < totalPages);

  return allQuestions;
}
```

### Deduplication

Use the question `id` as a unique key. Maintain a **processed set** to avoid re-answering:

```js
const processedIds = new Set();

function filterNewQuestions(questions) {
  const newQuestions = questions.filter(q => !processedIds.has(q.id));
  newQuestions.forEach(q => processedIds.add(q.id));
  return newQuestions;
}
```

### Retry / Backoff

```js
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return await response.json();
      if (response.status === 429 || response.status >= 500) {
        const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      if (attempt === maxRetries) throw error;
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}
```

---

## 8. Complete Polling Loop Example

```js
/**
 * Production-ready polling loop for Trendyol Customer Questions.
 * Designed for use in a Sim Studio Function block or Custom Tool.
 */

const SELLER_ID = '{{TRENDYOL_SELLER_ID}}';
const API_USER = '{{TRENDYOL_API_USER}}';
const API_PASS = '{{TRENDYOL_API_PASS}}';
const BASE_URL = 'https://apigw.trendyol.com/integration/qna/sellers';
const POLL_INTERVAL_MS = 3 * 60 * 1000; // 3 minutes
const MAX_RETRIES = 3;

function buildAuthHeaders() {
  return {
    'Authorization': 'Basic ' + btoa(API_USER + ':' + API_PASS),
    'Content-Type': 'application/json'
  };
}

async function fetchWithRetry(url, options, retries = MAX_RETRIES) {
  for (let i = 1; i <= retries; i++) {
    try {
      const res = await fetch(url, options);
      if (res.ok) return await res.json();
      if (res.status >= 500 || res.status === 429) {
        await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
        continue;
      }
      throw new Error(`HTTP ${res.status}`);
    } catch (err) {
      if (i === retries) throw err;
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, i)));
    }
  }
}

async function pollQuestions(lastTimestamp) {
  const now = Date.now();
  const start = lastTimestamp || (now - 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    status: 'WAITING_FOR_ANSWER',
    startDate: String(start),
    endDate: String(now),
    size: '50',
    page: '0',
    orderByField: 'CreatedDate',
    orderByDirection: 'ASC'
  });

  const data = await fetchWithRetry(
    `${BASE_URL}/${SELLER_ID}/questions/filter?${params}`,
    { method: 'GET', headers: buildAuthHeaders() }
  );

  // Handle pagination
  const allQuestions = [...data.content];
  let page = 1;
  while (page < data.totalPages) {
    params.set('page', String(page));
    const pageData = await fetchWithRetry(
      `${BASE_URL}/${SELLER_ID}/questions/filter?${params}`,
      { method: 'GET', headers: buildAuthHeaders() }
    );
    allQuestions.push(...pageData.content);
    page++;
  }

  // Return new watermark
  const newWatermark = allQuestions.length > 0
    ? Math.max(...allQuestions.map(q => q.creationDate)) + 1
    : start;

  return {
    questions: allQuestions,
    count: allQuestions.length,
    totalElements: data.totalElements,
    watermark: newWatermark
  };
}

async function submitAnswer(questionId, answerText) {
  if (answerText.length < 10 || answerText.length > 2000) {
    throw new Error('Answer must be 10-2000 characters');
  }

  const res = await fetch(
    `${BASE_URL}/${SELLER_ID}/questions/${questionId}/answers`,
    {
      method: 'POST',
      headers: buildAuthHeaders(),
      body: JSON.stringify({ text: answerText })
    }
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Answer failed for question ${questionId}: ${res.status} — ${body}`);
  }

  return { success: true, questionId };
}
```

---

## 9. Integration with Sim Studio

### Custom Tool: Fetch Customer Questions

Create a custom tool named `trendyol_fetch_questions` in your Sim workspace:

**Schema:**
```json
{
  "type": "function",
  "function": {
    "name": "trendyol_fetch_questions",
    "description": "Fetch unanswered customer questions from Trendyol marketplace. Returns product questions awaiting seller response.",
    "parameters": {
      "type": "object",
      "properties": {
        "status": {
          "type": "string",
          "enum": ["WAITING_FOR_ANSWER", "WAITING_FOR_APPROVE", "ANSWERED", "REPORTED", "REJECTED"],
          "description": "Filter by question status. Default: WAITING_FOR_ANSWER"
        },
        "barcode": {
          "type": "string",
          "description": "Optional barcode to filter questions for a specific product"
        },
        "page": {
          "type": "number",
          "description": "Page number (0-indexed). Default: 0"
        }
      },
      "required": []
    }
  }
}
```

**Code:**
```js
const sellerId = '{{TRENDYOL_SELLER_ID}}';
const credentials = btoa('{{TRENDYOL_API_USER}}' + ':' + '{{TRENDYOL_API_PASS}}');

const status = params.status || 'WAITING_FOR_ANSWER';
const page = params.page || 0;

const queryParams = new URLSearchParams({
  status: status,
  size: '50',
  page: String(page),
  orderByField: 'CreatedDate',
  orderByDirection: 'DESC'
});

if (params.barcode) {
  queryParams.set('barcode', params.barcode);
}

const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${queryParams}`;

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  }
});

if (!response.ok) {
  return { error: `Trendyol API error: ${response.status}`, success: false };
}

const data = await response.json();

return {
  success: true,
  questions: data.content.map(q => ({
    id: q.id,
    question: q.text,
    product: q.productName,
    productId: q.productMainId,
    customer: q.userName,
    date: new Date(q.creationDate).toISOString(),
    status: q.status,
    imageUrl: q.imageUrl,
    hasRejectedAnswer: q.rejectedAnswer !== null,
    rejectionReason: q.rejectedAnswer?.reason || null
  })),
  total: data.totalElements,
  page: data.page,
  totalPages: data.totalPages
};
```

### Custom Tool: Answer Customer Question

Create a custom tool named `trendyol_answer_question`:

**Schema:**
```json
{
  "type": "function",
  "function": {
    "name": "trendyol_answer_question",
    "description": "Submit an answer to a customer question on Trendyol. Answer must be 10-2000 characters. Answer will be moderated by Trendyol before publishing.",
    "parameters": {
      "type": "object",
      "properties": {
        "questionId": {
          "type": "number",
          "description": "The ID of the question to answer"
        },
        "answer": {
          "type": "string",
          "description": "Answer text (10-2000 characters)"
        }
      },
      "required": ["questionId", "answer"]
    }
  }
}
```

**Code:**
```js
const sellerId = '{{TRENDYOL_SELLER_ID}}';
const credentials = btoa('{{TRENDYOL_API_USER}}' + ':' + '{{TRENDYOL_API_PASS}}');

const { questionId, answer } = params;

// Validate
if (!answer || answer.length < 10) {
  return { success: false, error: 'Cevap en az 10 karakter olmalıdır.' };
}
if (answer.length > 2000) {
  return { success: false, error: 'Cevap en fazla 2000 karakter olabilir.' };
}

const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/${questionId}/answers`;

const response = await fetch(url, {
  method: 'POST',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ text: answer })
});

if (!response.ok) {
  const errorBody = await response.text();
  return {
    success: false,
    error: `Cevap gönderilemedi: HTTP ${response.status} — ${errorBody}`
  };
}

return {
  success: true,
  questionId: questionId,
  message: 'Cevap başarıyla gönderildi. Trendyol moderasyon sonrası yayınlanacaktır.',
  newStatus: 'WAITING_FOR_APPROVE'
};
```

### Workflow Pattern: Scheduled Question Answering

**Architecture:**

```
[Schedule Trigger (every 5 min)]
    → [Function: Fetch Questions]
    → [Condition: Has Questions?]
        → YES → [Loop: For each question]
            → [Agent: Generate Answer]
            → [Function: Submit Answer]
            → [Function: Log Result]
        → NO → [End]
```

**Schedule Trigger Setup:**
- Use Sim's **Schedule** trigger type
- Set cron: `*/5 * * * *` (every 5 minutes)
- The trigger fires, executing the workflow automatically

**Agent Block Prompt (for answer generation):**
```
You are a product support specialist for a Trendyol seller. Your job is to answer customer questions about products.

Rules:
- Answer in Turkish
- Be professional and helpful
- Answer must be 10-2000 characters
- Include specific product details when available
- If you cannot answer, say so and suggest contacting customer service
- Never include personal information or contact details

Question: {{question.text}}
Product: {{question.productName}}
Product ID: {{question.productMainId}}
```

### Using Question Data in Agent Blocks

Reference fetched question data using Sim's tag syntax:

```
Product: <functionBlock.output.questions[0].product>
Question: <functionBlock.output.questions[0].question>
Customer: <functionBlock.output.questions[0].customer>
```

Or in a loop context:
```
<loopItem.question>
<loopItem.product>
<loopItem.id>
```

---

## 10. Best Practices

### Idempotent Processing

- **Always** check if a question has already been answered before submitting
- Use the question `id` as a deduplication key
- Store processed IDs in workflow variables or an external store
- Check `status !== 'WAITING_FOR_ANSWER'` before attempting to answer

### Rate Limiting

- Trendyol does **not** document explicit rate limits for the Q&A API
- Be **conservative**: poll no more frequently than every **3 minutes**
- Use exponential backoff on `429` or `5xx` errors
- Batch operations where possible (fetch page of 50, then process)

### Error Handling

| HTTP Status | Meaning | Action |
|-------------|---------|--------|
| 200 | Success | Process response |
| 400 | Bad request (validation) | Check parameters/body |
| 401 | Unauthorized | Verify credentials |
| 403 | Forbidden | Check seller ID / permissions |
| 404 | Not found | Question ID may be invalid |
| 429 | Rate limited | Back off, retry after delay |
| 500+ | Server error | Retry with exponential backoff |

### Status Filtering for Efficient Polling

- **Always** filter by `status=WAITING_FOR_ANSWER` for actionable questions
- To monitor rejected answers, also poll for `status=REJECTED`
- Use `orderByField=LastModifiedDate` for change-based polling
- Use `orderByField=CreatedDate` for new-question-based polling

### Webhook Alternatives

Trendyol **does NOT offer webhooks for customer questions**. Webhooks are only available for order status changes. The only integration method for customer questions is **polling** via the filter endpoint.

**Why polling is necessary:**
- No event-driven mechanism exists for Q&A
- Trendyol's webhook system only covers order package lifecycle events
- The Q&A API is designed for periodic pull-based consumption

### Data Consistency

- Always use `startDate` / `endDate` params to scope your queries
- Remember the **2-week maximum** date range constraint
- For continuous polling, maintain a **watermark** (last processed timestamp)
- If your watermark is older than 2 weeks, reset it to `now - 14 days`

### Answer Quality Guidelines

- **Minimum 10 characters** — very short answers will be rejected by the API
- **Maximum 2,000 characters** — truncate if needed
- Answers go through **Trendyol moderation** before publishing
- Rejected answers can be resubmitted with corrections
- Do not include personal information, phone numbers, or external URLs

---

## 11. Question Lifecycle & Status Flow

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

---

## 12. Critical Gotchas

- **Timestamps are Unix milliseconds** (13-digit numbers like `1700000000000`), NOT seconds
- **`supplierId`** is mandatory in the URL path — every request must include it
- **Page numbers are 0-indexed** (first page = `page=0`)
- **Maximum page size is 50** — larger values will be rejected or clamped
- **Date range cannot exceed 2 weeks** — the API will return an error or no data
- **No date params = last 7 days only** — you may miss older questions
- **Reporting questions** is only possible via the Trendyol Seller Panel (web UI), not via API
- **Answer moderation** is not instant — there is a delay before answers appear on trendyol.com
- **`productMainId`** is the seller's SKU/model code, not Trendyol's internal product ID
- **Auth is per-request** — no session/token caching needed (unlike OAuth flows)
