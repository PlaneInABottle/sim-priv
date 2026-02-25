# Code Examples

All JavaScript code snippets for working with the Trendyol Customer Questions API.

> **⚠️ Sim Studio Note:** `btoa()` and `URLSearchParams` are **not available** in Sim's
> isolated-vm sandbox. All examples below use manual implementations. See
> [Gotchas & Constraints](gotchas-and-constraints.md#15-sim-studio-isolated-vm-execution-constraints)
> for the full list of unavailable APIs.

## Helper Functions

These helpers are used throughout the examples and must be included in every custom tool:

```js
// Manual Base64 encoder — btoa() is NOT available in Sim's isolated-vm sandbox
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

// Manual query string builder — URLSearchParams is NOT available in isolated-vm
function buildQueryString(paramsObj) {
  return Object.entries(paramsObj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
}
```

---

## Quick Start — Fetch Unanswered Questions

```js
const sellerId = '123456';
const credentials = base64Encode('your-api-key:your-api-secret');

const res = await fetch(
  `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?status=WAITING_FOR_ANSWER&size=50&page=0`,
  {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': `${sellerId} - SelfIntegration`
    }
  }
);
const data = await res.json();
// data.content = array of question objects
// data.totalElements = total matching questions
```

---

## Fetch Unanswered Questions (Full)

```js
async function fetchUnansweredQuestions(sellerId, credentials, page = 0) {
  const qs = buildQueryString({
    status: 'WAITING_FOR_ANSWER',
    size: '50',
    page: String(page),
    orderByField: 'CreatedDate',
    orderByDirection: 'DESC'
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

  if (!response.ok) {
    throw new Error(`Trendyol API error: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

// Usage
const sellerId = '123456';
const credentials = base64Encode('myApiKey:myApiSecret');
const result = await fetchUnansweredQuestions(sellerId, credentials);
console.log(`Found ${result.totalElements} unanswered questions`);

const content = (result && result.content) ? result.content : [];
for (const q of content) {
  console.log(`[${q.id}] ${q.productName}: "${q.text}"`);
}
```

---

## Get Single Question Detail

```js
async function getQuestionDetail(sellerId, questionId, credentials) {
  const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/${questionId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/json',
      'User-Agent': `${sellerId} - SelfIntegration`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch question ${questionId}: ${response.status}`);
  }

  return await response.json();
}
```

---

## Answer a Question

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
      'Content-Type': 'application/json',
      'User-Agent': `${sellerId} - SelfIntegration`
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

## Complete Production Polling Loop

A production-ready polling loop designed for Sim Studio Custom Tools.

```js
/**
 * Production-ready polling loop for Trendyol Customer Questions.
 * Designed for use in a Sim Studio Custom Tool.
 *
 * ⚠️ Uses manual Base64 encoding and query string building
 * because btoa() and URLSearchParams are not available in isolated-vm.
 */

const SELLER_ID = '{{TRENDYOL_SELLER_ID}}';
const API_KEY = '{{TRENDYOL_API_KEY}}';
const API_SECRET = '{{TRENDYOL_API_SECRET}}';
const BASE_URL = 'https://apigw.trendyol.com/integration/qna/sellers';
const MAX_RETRIES = 3;

function buildAuthHeaders() {
  return {
    'Authorization': 'Basic ' + base64Encode(API_KEY + ':' + API_SECRET),
    'Content-Type': 'application/json',
    'User-Agent': `${SELLER_ID} - SelfIntegration`
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
  // All retries exhausted without success or explicit error
  throw new Error(`fetchWithRetry: all ${retries} retries exhausted for ${url}`);
}

async function pollQuestions(lastTimestamp) {
  const now = Date.now();
  const start = lastTimestamp || (now - 24 * 60 * 60 * 1000);

  const qs = buildQueryString({
    status: 'WAITING_FOR_ANSWER',
    startDate: String(start),
    endDate: String(now),
    size: '50',
    page: '0',
    orderByField: 'CreatedDate',
    orderByDirection: 'ASC'
  });

  const data = await fetchWithRetry(
    `${BASE_URL}/${SELLER_ID}/questions/filter?${qs}`,
    { method: 'GET', headers: buildAuthHeaders() }
  );

  // Handle pagination
  const content = (data && data.content) ? data.content : [];
  const allQuestions = [...content];
  let page = 1;
  while (page < (data.totalPages || 1)) {
    const pageQs = buildQueryString({
      status: 'WAITING_FOR_ANSWER',
      startDate: String(start),
      endDate: String(now),
      size: '50',
      page: String(page),
      orderByField: 'CreatedDate',
      orderByDirection: 'ASC'
    });
    const pageData = await fetchWithRetry(
      `${BASE_URL}/${SELLER_ID}/questions/filter?${pageQs}`,
      { method: 'GET', headers: buildAuthHeaders() }
    );
    const pageContent = (pageData && pageData.content) ? pageData.content : [];
    allQuestions.push(...pageContent);
    page++;
  }

  // Return new watermark
  const newWatermark = allQuestions.length > 0
    ? Math.max(...allQuestions.map(q => q.creationDate)) + 1
    : start;

  return {
    questions: allQuestions,
    count: allQuestions.length,
    totalElements: data.totalElements || 0,
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

## Fetch with Retry / Backoff (Standalone)

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

---

## Date Range Helper

```js
// Example: last 3 days
const endDate = Date.now();
const startDate = endDate - (3 * 24 * 60 * 60 * 1000);
// Use: ?startDate=${startDate}&endDate=${endDate}
```
