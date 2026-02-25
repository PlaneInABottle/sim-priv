# Polling Strategy

Since Trendyol does **NOT support webhooks** for customer questions, you must use **scheduled polling**. Webhooks are only available for order status events.

## Why Polling is Necessary

- No event-driven mechanism exists for Q&A
- Trendyol's webhook system only covers order package lifecycle events
- The Q&A API is designed for periodic pull-based consumption

## Recommended Poll Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Poll interval** | 3–5 minutes | Conservative; no documented rate limit but be respectful |
| **Status filter** | `WAITING_FOR_ANSWER` | Only fetch actionable questions |
| **Sort** | `orderByField=CreatedDate&orderByDirection=DESC` | Newest first |
| **Page size** | `50` (maximum) | Minimize request count |
| **Date range** | Last 24 hours or use `lastModifiedDate` tracking | Stay within 2-week max |

## Watermark-Based State Tracking

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

## Handling Pagination in Polls

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

## Deduplication

Use the question `id` as a unique key. Maintain a **processed set** to avoid re-answering:

```js
const processedIds = new Set();

function filterNewQuestions(questions) {
  const newQuestions = questions.filter(q => !processedIds.has(q.id));
  newQuestions.forEach(q => processedIds.add(q.id));
  return newQuestions;
}
```

## Retry / Backoff

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

## Watermark Reset

For continuous polling, maintain a watermark (last processed timestamp). Critical rules:

- Always use `startDate` / `endDate` params to scope your queries
- Remember the **2-week maximum** date range constraint
- If your watermark is older than 2 weeks, reset it to `now - 14 days`

```js
// Reset stale watermarks
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
if (Date.now() - lastPollTimestamp > TWO_WEEKS_MS) {
  lastPollTimestamp = Date.now() - TWO_WEEKS_MS;
}
```
