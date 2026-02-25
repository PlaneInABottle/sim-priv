---
name: trendyol-api
description: Complete guide for Trendyol Customer Questions API integration in Sim Studio workflows. Covers fetching customer questions via polling, answering questions, authentication, data models, and scheduling strategies.
---

# Trendyol Customer Questions API

Complete guide for integrating Trendyol's Customer Questions (Q&A) API into Sim Studio workflows — covering polling-based question retrieval, answer submission, and automated response workflows.

## Quick Start

**Base URL (Production):** `https://apigw.trendyol.com/integration/qna/sellers/{sellerId}`
**Base URL (Stage):** `https://stageapigw.trendyol.com/integration/qna/sellers/{sellerId}`
**Protocol:** REST (JSON) | **Auth:** HTTP Basic Auth OR API Key

> **Important:** Trendyol does NOT support webhooks for customer questions. Questions must be retrieved via **polling** (scheduled GET requests). See [Polling Strategy](references/polling-strategy.md) for details.

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

## Table of Contents

| Reference | Description |
|-----------|-------------|
| [API Reference](references/api-reference.md) | All 3 endpoints, methods, base URLs, response structures, lifecycle flow |
| [Parameters](references/parameters.md) | Complete query parameter table, status values, sorting, date constraints |
| [Data Models](references/data-models.md) | Question, Answer, RejectedAnswer, Pagination schemas with field descriptions |
| [Authentication](references/authentication.md) | Basic Auth, API Key setup, credential storage, seller ID requirement |
| [Code Examples](references/code-examples.md) | All JavaScript/TypeScript snippets — fetch, answer, polling loop, retry |
| [Polling Strategy](references/polling-strategy.md) | Intervals, watermark tracking, pagination, deduplication, retry/backoff |
| [Sim Integration](references/sim-integration.md) | Custom tool schemas, workflow architecture, agent prompts, tag syntax |
| [Best Practices](references/best-practices.md) | Error handling, rate limiting, idempotency, answer quality, data consistency |
| [Gotchas & Constraints](references/gotchas-and-constraints.md) | 12 critical pitfalls, API limitations, regional considerations |

---

## API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `.../questions/filter` | List/filter questions with pagination |
| **GET** | `.../questions/{id}` | Get single question detail |
| **POST** | `.../questions/{id}/answers` | Submit an answer (10-2000 chars) |

Full details: [API Reference](references/api-reference.md)

## Key Status Values

| Status | Meaning |
|--------|---------|
| `WAITING_FOR_ANSWER` | Awaiting seller response (poll this) |
| `WAITING_FOR_APPROVE` | Submitted, pending Trendyol moderation |
| `ANSWERED` | Approved and published |
| `REJECTED` | Answer rejected — can re-submit |
| `REPORTED` | Reported via Seller Panel (UI only) |

Full details: [Parameters](references/parameters.md)

## Question Lifecycle

```
[WAITING_FOR_ANSWER] → Submit answer → [WAITING_FOR_APPROVE]
    → Approved → [ANSWERED]
    → Rejected → [REJECTED] → Re-answer → [WAITING_FOR_APPROVE]
```

Full flow diagram: [API Reference — Lifecycle](references/api-reference.md#question-lifecycle--status-flow)

---

## Top Gotchas (Quick Reference)

1. **Timestamps are milliseconds** (13-digit), not seconds
2. **Pages are 0-indexed** (`page=0` is first page)
3. **Max page size is 50**
4. **Date range max is 2 weeks**; no params = last 7 days only
5. **No webhooks for Q&A** — polling only

Full list: [Gotchas & Constraints](references/gotchas-and-constraints.md)

---

## When to Use This Skill

Use this skill when you need to:

- **Fetch customer questions** from Trendyol marketplace via API
- **Answer customer questions** programmatically
- **Build automated Q&A workflows** in Sim Studio with polling
- **Create custom tools** for Trendyol Q&A in Sim workspaces
- **Understand Trendyol Q&A data models** and status lifecycle
- **Set up polling strategies** since webhooks aren't available for Q&A

## Navigation

### Getting Started
→ [Authentication](references/authentication.md) — Set up credentials
→ [API Reference](references/api-reference.md) — Understand the endpoints

### Building
→ [Code Examples](references/code-examples.md) — Copy-paste JavaScript snippets
→ [Polling Strategy](references/polling-strategy.md) — Set up scheduled polling
→ [Sim Integration](references/sim-integration.md) — Workflow patterns & custom tools

### Reference
→ [Parameters](references/parameters.md) — Query parameter details
→ [Data Models](references/data-models.md) — JSON schemas
→ [Best Practices](references/best-practices.md) — Production guidelines
→ [Gotchas & Constraints](references/gotchas-and-constraints.md) — Avoid common mistakes
