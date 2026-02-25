---
name: trendyol-api
description: Reference for Trendyol Customer Questions API — fetching and answering customer questions. Based exclusively on official Trendyol developer documentation.
---

# Trendyol Customer Questions API

Reference for Trendyol's Customer Questions (Q&A) API — fetching customer questions and submitting answers.

**Source documentation:**
- [Müşteri Sorularını Çekme](https://developers.trendyol.com/docs/müşteri-sorularını-çekme) (Fetching)
- [Müşteri Sorularını Cevaplama](https://developers.trendyol.com/docs/müşteri-sorularını-cevaplama) (Answering)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| **GET** | `.../sellers/{supplierId}/questions/filter` | List/filter questions with pagination |
| **GET** | `.../sellers/{supplierId}/questions/{id}` | Get single question by ID |
| **POST** | `.../sellers/{sellerId}/questions/{id}/answers` | Submit an answer to a question |

## Key Constraints (from official docs)

- No date parameters → returns last **1 week** of questions
- With `startDate`/`endDate` → maximum range is **2 weeks**
- Page size maximum: **50**
- Answer text: minimum **10** characters, maximum **2000** characters
- `supplierId` is **required** in the filter request
- Timestamps use **milliseconds** (not seconds)

## Status Values

| Status | Description |
|--------|-------------|
| `WAITING_FOR_ANSWER` | Awaiting seller response |
| `WAITING_FOR_APPROVE` | Submitted, pending approval |
| `ANSWERED` | Approved and published |
| `REJECTED` | Answer rejected |
| `REPORTED` | Reported (via Trendyol Seller Panel only) |

## References

| File | Contents |
|------|----------|
| [API Reference](references/api-reference.md) | All 3 endpoints with URLs, methods, and response examples |
| [Parameters](references/parameters.md) | Query parameters for the filter endpoint |
| [Data Models](references/data-models.md) | Response JSON structures and field descriptions |
| [Authentication](references/authentication.md) | Basic Auth note |

## When to Use This Skill

Use when you need to:
- Fetch customer questions from Trendyol marketplace
- Answer customer questions via the API
- Understand the Q&A data model and status values
