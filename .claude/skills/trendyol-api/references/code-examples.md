# Code Examples

All JavaScript/TypeScript code snippets for working with the Trendyol Customer Questions API.

## Quick Start — Fetch Unanswered Questions

```js
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

## Fetch Unanswered Questions (Full)

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

## Get Single Question Detail

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

## Complete Production Polling Loop

A production-ready polling loop designed for Sim Studio Function blocks or Custom Tools.

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
