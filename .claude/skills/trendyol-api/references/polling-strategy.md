# Polling Strategy

Since Trendyol does **NOT support webhooks** for customer questions, you must use **scheduled polling**. Webhooks are only available for order status events.

## Why Polling is Necessary

- No event-driven mechanism exists for Q&A
- Trendyol's webhook system only covers order package lifecycle events
- The Q&A API is designed for periodic pull-based consumption

## Recommended Poll Configuration

| Setting | Value | Rationale |
|---------|-------|-----------|
| **Poll interval** | 3–5 minutes | Rate limit is 50 req/endpoint/10s — be conservative |
| **Status filter** | `WAITING_FOR_ANSWER` | Only fetch actionable questions |
| **Sort** | `orderByField=CreatedDate&orderByDirection=DESC` | Newest first |
| **Page size** | `50` (maximum) | Minimize request count |
| **Date range** | Last 24 hours or use `lastModifiedDate` tracking | Stay within 2-week max |

## ⚠️ Stateless Execution Warning

> **CRITICAL:** Sim Studio workflow executions are **stateless**. Each execution runs in a
> fresh context — in-memory JavaScript variables (`let`, `const`, `var`) do **NOT persist**
> across executions. Code like `let lastPollTimestamp = ...` will reset every time.

### How to Persist State in Sim

1. **Workflow Variables**: Use Sim workflow variables to store state between executions.
   Reference them via `<variable.lastPollTimestamp>` in block inputs or `{{lastPollTimestamp}}`
   in custom tool code. Update them via workflow variable output mappings.

2. **External Storage**: For more complex state (e.g., processed ID sets), use an external
   database or key-value store that your custom tool can query via `fetch()`.

## Watermark-Based State Tracking

Track the **last poll timestamp** using a **Sim workflow variable** to avoid reprocessing:

```js
// ⚠️ Use a Sim workflow variable for lastPollTimestamp, NOT a local variable.
// In custom tool code, reference it as: '{{lastPollTimestamp}}'
// The variable should be of type "number" with initial value of 0.

const lastPoll = Number('{{lastPollTimestamp}}') || (Date.now() - (24 * 60 * 60 * 1000));

// Manual query string builder — URLSearchParams is NOT available in isolated-vm
function buildQueryString(paramsObj) {
  return Object.entries(paramsObj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
}

async function pollNewQuestions(sellerId, credentials) {
  const qs = buildQueryString({
    status: 'WAITING_FOR_ANSWER',
    startDate: String(lastPoll),
    endDate: String(Date.now()),
    size: '50',
    page: '0',
    orderByField: 'CreatedDate',
    orderByDirection: 'ASC'
  });

  const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${qs}`;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': `${sellerId} - SelfIntegration`
    }
  });

  const data = await response.json();
  const content = (data && data.content) ? data.content : [];

  // Return new watermark — map this to the workflow variable via output mapping
  let newWatermark = lastPoll;
  if (content.length > 0) {
    newWatermark = Math.max(...content.map(q => q.creationDate)) + 1;
  }

  return { questions: content, newWatermark: newWatermark };
}
```

## Handling Pagination in Polls

If `totalPages > 1`, iterate through all pages:

```js
// Manual query string builder — URLSearchParams is NOT available in isolated-vm
function buildQueryString(paramsObj) {
  return Object.entries(paramsObj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
}

async function fetchAllPages(sellerId, credentials, baseParams) {
  const allQuestions = [];
  let page = 0;
  let totalPages = 1;

  do {
    const qs = buildQueryString({ ...baseParams, page: String(page), size: '50' });
    const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${qs}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
        'User-Agent': `${sellerId} - SelfIntegration`
      }
    });

    const data = await response.json();
    const content = (data && data.content) ? data.content : [];
    allQuestions.push(...content);
    totalPages = data.totalPages || 1;
    page++;
  } while (page < totalPages);

  return allQuestions;
}
```

## Deduplication

Use the question `id` as a unique key. Since Sim executions are **stateless**, you cannot use
in-memory `Set` objects. Instead, use one of these approaches:

1. **Workflow Variables**: Store a comma-separated list of processed IDs in a workflow variable.
2. **External Store**: Use a database or key-value store to track processed question IDs.
3. **Date Watermark**: Rely on `startDate`/`endDate` filtering to avoid reprocessing (simplest).

```js
// Example: deduplication via workflow variable (comma-separated ID list)
const processedIdsStr = '{{processedQuestionIds}}' || '';
const processedIds = processedIdsStr ? processedIdsStr.split(',') : [];

function filterNewQuestions(questions) {
  const newQuestions = questions.filter(q => !processedIds.includes(String(q.id)));
  // Return new IDs to be appended to the workflow variable via output mapping
  const newIds = newQuestions.map(q => String(q.id));
  return { newQuestions, updatedIds: processedIds.concat(newIds).join(',') };
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
  // All retries exhausted without success or explicit error
  throw new Error(`fetchWithRetry: all ${maxRetries} retries exhausted for ${url}`);
}
```

## Watermark Reset

For continuous polling, maintain a watermark using a **Sim workflow variable** (e.g., `lastPollTimestamp`). Critical rules:

- Always use `startDate` / `endDate` params to scope your queries
- Remember the **2-week maximum** date range constraint
- If your watermark is older than 2 weeks, reset it to `now - 14 days`

```js
// Reset stale watermarks — use workflow variable, not in-memory variable
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
let lastPoll = Number('{{lastPollTimestamp}}') || 0;
if (lastPoll === 0 || (Date.now() - lastPoll) > TWO_WEEKS_MS) {
  lastPoll = Date.now() - TWO_WEEKS_MS;
}
// Map lastPoll back to the workflow variable via the tool's output mapping
```
