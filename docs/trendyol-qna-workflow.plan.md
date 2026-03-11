# Trendyol Q&A Auto-Response Workflow — Complete Design

> **Status**: Design Complete — All Analyzer Fixes Applied — Production-Ready Specification  
> **Last Updated**: 2025-07-23  
> **Target Platform**: Sim Studio (sim-mcp workflow builder)
> **Revision**: v4.1 — Final blocking fixes: JSON injection mitigated with escape function block; fallback block pattern documented; metrics_collector property path corrected; edge count updated to 19

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Block Specification Table](#2-block-specification-table)
3. [Variable Definitions](#3-variable-definitions)
4. [API Call Specifications](#4-api-call-specifications)
5. [Loop + AI Integration Flow](#5-loop--ai-integration-flow)
6. [Testing Strategy](#6-testing-strategy)
7. [Error Handling Matrix](#7-error-handling-matrix)
8. [Key Decisions](#8-key-decisions)
9. [Workflow JSON Structure](#9-workflow-json-structure)
10. [Implementation Checklist](#10-implementation-checklist)

---

## 1. Architecture Overview

### 1.1 Purpose

Automatically answer unanswered Trendyol marketplace customer questions by:
1. Polling for unanswered questions on a schedule (every 10 minutes)
2. For each question: fetching related product details for context enrichment
3. Sending the question + product context to an AI agent for response generation
4. Posting the AI-generated response back to Trendyol (disableable for testing)

### 1.2 Architecture Diagram

```
┌───────────────────┐
│  Schedule Trigger  │  (Every 10 min)
│   "Scheduler"      │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Fetch Questions   │  GET /questions/filter?status=WAITING_FOR_ANSWER&size=25
│  "Fetch Questions" │  → response.data.content (array)
│  (API block)       │
└────────┬──────────┘
         │
         ▼
┌───────────────────┐
│  Check Questions   │  if <Fetch Questions.data.content>.length > 0
│  "Has Questions"   │  → condition-has_questions / condition-no_questions
│  (Condition block) │
└────────┬──────────┘
         │ condition-has_questions          │ condition-no_questions
         ▼                                 ▼
┌────────────────────────────────────────────────────────────┐   (end → Workflow Result)
│  LOOP: Process Questions                                    │
│  "Question Loop"                                            │
│  forEach: <Fetch Questions.data.content>                    │
│  (iterates full array; batch size=25 via API param)         │
│                                                              │
│  ┌──────────────────────────┐                                │
│  │  Fetch Product Details    │──error──┐                     │
│  │  "Fetch Product"          │         │                     │
│  │  (API block — nested)     │         ▼                     │
│  │  GET /products/approved   │  ┌─────────────────────┐     │
│  │  ?productMainId=...       │  │ Product Fetch        │     │
│  └────────────┬─────────────┘  │ Fallback (Function)  │     │
│               │                 │ → { content: [] }    │     │
│               │◄────────────────┘                       │     │
│               ▼                                         │     │
│  ┌──────────────────────────┐                                │
│  │  AI Agent                 │──error──┐                     │
│  │  "Answer Generator"       │         │                     │
│  │  (Agent block — nested)   │         ▼                     │
│  │  system: E-commerce       │  ┌─────────────────────┐     │
│  │    support expert         │  │ Answer Generation    │     │
│  │  user: question +         │  │ Fallback (Function)  │     │
│  │    product context        │  │ → logs error, skips  │     │
│  └────────────┬─────────────┘  └─────────────────────┘     │
│               │                                              │
│               ▼                                              │
│  ┌──────────────────────────┐                                │
│  │  Validate Answer          │                                │
│  │  "Validate Answer"        │                                │
│  │  (Condition block)        │                                │
│  │  10 ≤ len ≤ 2000?        │                                │
│  └───────┬──────────────────┘                                │
│          │condition-valid       │condition-invalid             │
│          ▼                     ▼                              │
│  ┌──────────────────────────┐  (skip — log invalid answer)   │
│  │  Escape Answer Text       │                                │
│  │  "Escape Answer Text"     │                                │
│  │  (Function block)         │                                │
│  │  JSON-escape AI text      │                                │
│  └────────────┬─────────────┘                                │
│               ▼                                              │
│  ┌──────────────────────────┐                                │
│  │  Send Answer              │──error──┐                     │
│  │  "Send Answer"            │         │                     │
│  │  (API block — nested)     │         ▼                     │
│  │  POST /questions/{id}/    │  ┌─────────────────────┐     │
│  │    answers                │  │ Send Answer          │     │
│  │  ⚠️ DISABLED for testing  │  │ Fallback (Function)  │     │
│  └──────────────────────────┘  │ → logs error          │     │
│                                 └─────────────────────┘     │
│                                                              │
│  ┌──────────────────────────┐                                │
│  │  Metrics Collector        │                                │
│  │  "Metrics" (Function)     │                                │
│  │  Tracks counts & errors   │                                │
│  └──────────────────────────┘                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
         │
         ▼
┌───────────────────┐
│  Response Block    │  Summary of processed questions + metrics
│  "Workflow Result" │
│  (Response block)  │
└───────────────────┘
```

> ⚠️ **DEPLOYMENT SAFETY WARNING**: Schedule trigger runs against the **deployed** workflow state, NOT the draft. Manual test executions use draft state and respect block toggles. **Never deploy the workflow with Send Answer enabled until Phase 2 testing is complete.**

### 1.3 Data Flow Summary

```
Scheduler → [Trigger every 10 min]
  → Fetch Questions API (size=25) → questions[]
    → Condition: questions.length > 0?
      → YES → Loop(forEach questions, max 25):
        → Fetch Product API (/approved?productMainId=...)
            → on success: product details
            → on error: product_fetch_fallback → { content: [] }
        → AI Agent(question + product) → generated answer
            → on error: answer_generation_fallback → skip iteration
        → Validate Answer (condition: 10-2000 chars?)
            → condition-valid → Escape Answer Text (JSON-escape)
              → Send Answer API [DISABLED for testing]
                → on error: send_answer_fallback → log & continue
            → condition-invalid → skip send, log invalid answer
        → Metrics Collector (track counts & errors)
      → NO → End (no-op)
  → Response: execution summary + metrics
```

---

## 2. Block Specification Table

### 2.1 All Blocks

| # | Block ID | Block Name | Block Type | Nested In | Position (x,y) | Enabled |
|---|----------|-----------|------------|-----------|----------------|---------|
| 1 | `scheduler` | Scheduler | `schedule` | — | (100, 300) | ✅ |
| 2 | `fetch_questions` | Fetch Questions | `api` | — | (400, 300) | ✅ |
| 3 | `has_questions` | Has Questions | `condition` | — | (700, 300) | ✅ |
| 4 | `question_loop` | Question Loop | `loop` | — | (1000, 300) | ✅ |
| 5 | `fetch_product` | Fetch Product | `api` | `question_loop` | (1100, 250) | ✅ |
| 6 | `product_fetch_fallback` | Product Fetch Fallback | `function` | `question_loop` | (1100, 450) | ✅ |
| 7 | `answer_generator` | Answer Generator | `agent` | `question_loop` | (1400, 250) | ✅ |
| 8 | `answer_generation_fallback` | Answer Generation Fallback | `function` | `question_loop` | (1400, 450) | ✅ |
| 9 | `validate_answer` | Validate Answer | `condition` | `question_loop` | (1700, 250) | ✅ |
| 10 | `escape_answer_text` | Escape Answer Text | `function` | `question_loop` | (1700, 350) | ✅ |
| 11 | `send_answer` | Send Answer | `api` | `question_loop` | (2000, 200) | ❌ **DISABLED** |
| 12 | `send_answer_fallback` | Send Answer Fallback | `function` | `question_loop` | (2000, 450) | ✅ |
| 13 | `metrics_collector` | Metrics | `function` | `question_loop` | (2300, 250) | ✅ |
| 14 | `workflow_result` | Workflow Result | `response` | — | (2600, 300) | ✅ |

### 2.2 Block Details

#### Block 1: Scheduler (Trigger)

| Property | Value |
|----------|-------|
| **Type** | `schedule` |
| **scheduleType** | `"custom"` |
| **cronExpression** | `"*/10 * * * *"` (every 10 minutes) |
| **timezone** | `"Europe/Istanbul"` |
| **Purpose** | Triggers the workflow on a recurring schedule |

> **Rationale for 10-minute interval**: Processing 25 questions takes ~30–60 seconds. A 10-minute interval provides ample margin to avoid overlapping executions and respects Trendyol API rate limits.

#### Block 2: Fetch Questions (API)

| Property | Value |
|----------|-------|
| **Type** | `api` |
| **Method** | `GET` |
| **URL** | `https://apigw.trendyol.com/integration/qna/sellers/<variable.supplierId>/questions/filter?status=WAITING_FOR_ANSWER&size=25` |
| **Headers** | `[["Authorization", "{{TRENDYOL_AUTH_HEADER}}"], ["Content-Type", "application/json"], ["User-Agent", "<variable.userAgent>"]]` |
| **Timeout** | `30000` (30 seconds) |
| **Output** | `.data` → `{ content: [...questions], totalElements, totalPages, page, size }` |
| **Output** | `.status` → HTTP status code (200, 401, etc.) |

#### Block 3: Has Questions (Condition)

| Property | Value |
|----------|-------|
| **Type** | `condition` |
| **Conditions** | `[{"id": "has_questions", "title": "if", "value": "<Fetch Questions.data.content> && <Fetch Questions.data.content>.length > 0"}, {"id": "no_questions", "title": "else", "value": ""}]` |
| **Purpose** | Skip the loop entirely if no unanswered questions found |
| **Edge Handles** | `condition-has_questions` → Question Loop, `condition-no_questions` → Workflow Result |

#### Block 4: Question Loop (Loop Subflow)

| Property | Value |
|----------|-------|
| **Type** | `loop` |
| **loopType** | `"forEach"` |
| **array** | `<Fetch Questions.data.content>` |
| **Iteration** | Iterates over all questions returned (batch size controlled by API `size=25` parameter; `maxIterations` is not used for `forEach` loops) |
| **Nested Blocks** | `fetch_product`, `product_fetch_fallback`, `answer_generator`, `answer_generation_fallback`, `validate_answer`, `escape_answer_text`, `send_answer`, `send_answer_fallback`, `metrics_collector` |
| **Output** | `.results` → array of arrays (per-iteration block outputs) |

**Current Item Access Inside Loop:**
- `<loop.item>` — the full question object for the current iteration
- `<loop.item.id>` — question ID
- `<loop.item.text>` — question text
- `<loop.item.productName>` — product name from question
- `<loop.item.productMainId>` — product main ID (for product API lookup)
- `<loop.item.userName>` — customer username
- `<loop.item.creationDate>` — question creation timestamp
- `<loop.index>` — 0-based iteration index

#### Block 5: Fetch Product (API — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `api` |
| **Parent** | `question_loop` |
| **Method** | `GET` |
| **URL** | `https://apigw.trendyol.com/integration/product/sellers/<variable.supplierId>/products/approved?productMainId=<loop.item.productMainId>` |
| **Headers** | `[["Authorization", "{{TRENDYOL_AUTH_HEADER}}"], ["Content-Type", "application/json"], ["User-Agent", "<variable.userAgent>"]]` |
| **Timeout** | `15000` (15 seconds) |
| **Output** | `.data.content[0]` → product object with title, brand, description, attributes, etc. |
| **Error Handling** | Error port edge (`sourceHandle: "error"`) → `product_fetch_fallback` block. If product API fails, the fallback returns `{ content: [] }` so the AI agent can still generate an answer with available info. |

#### Block 6: Product Fetch Fallback (Function — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `function` |
| **Parent** | `question_loop` |
| **Purpose** | Catches errors from Fetch Product; returns empty product data so the loop continues |
| **Code** | See below |
| **Output** | `{ data: { content: [] }, error: true, message: "Product fetch failed" }` |

```javascript
// product_fetch_fallback function code
// Fallback when product fetch fails — return empty product data so AI continues
return {
  data: { content: [] },
  error: true,
  message: "Product fetch failed"
};
```

> **Fallback Design Note**: Fallback blocks prevent loop crashes and log errors. Their return values are not consumed by downstream blocks; instead, blocks referencing the original failed block (e.g., `<Fetch Product.data>`) receive `undefined` for missing fields. The AI agent gracefully handles missing product data by answering with just the question text and productName. See [Section 7.1 Error Handling Notes](#71-error-scenarios-and-responses) for details.

#### Block 7: Answer Generator (Agent — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `agent` |
| **Parent** | `question_loop` |
| **Model** | `openrouter/openai/gpt-5.1-codex-mini` _(synced with Kamatas PROD workflow)_ |
| **API Key** | `{{OPENROUTER_API_KEY}}` _(OpenRouter API key — environment variable)_ |
| **Temperature** | _Not set_ (uses model default; matches Kamatas PROD) |
| **Messages** | See [Section 5.2](#52-ai-agent-prompt-design) |
| **Tools** | None _(Trendyol Q&A is single-shot; no browsing/handoff tools needed)_ |
| **Memory** | None _(single-shot per question; no conversation context required)_ |
| **Response Format** | None _(plain text answer; no structured JSON needed)_ |
| **Output** | `.content` → the generated answer text |
| **Error Handling** | Error port edge (`sourceHandle: "error"`) → `answer_generation_fallback` block |

> **Kamatas PROD Sync Note**: This block's model and API key reference are synced with the Kamatas PROD workflow (`98c363ef-febc-42cc-82d2-d40b501c5b56`), which uses `openrouter/openai/gpt-5.1-codex-mini` via OpenRouter. The Kamatas agent additionally uses 5 custom tools (`handoff_to_human`, `ikas_browse`, `ikas_lookup_customer_orders`, `calculate_product_price`, `get_products_by_main_category`), sliding-window memory (size 15), and a structured response format — none of which are needed for single-shot Trendyol Q&A. No skills are configured in the Kamatas workspace.

#### Block 8: Answer Generation Fallback (Function — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `function` |
| **Parent** | `question_loop` |
| **Purpose** | Catches errors from Answer Generator; logs error and skips the iteration |
| **Code** | See below |
| **Output** | `{ content: "", error: true, message: "..." }` |

```javascript
// answer_generation_fallback function code
// Fallback when AI agent fails — return empty content that validation will reject
console.error("Answer generation failed");
return {
  content: "",
  error: true,
  message: "Answer generation failed",
  skip: true // signals downstream blocks to skip this iteration
};
```

> **Fallback Design Note**: When answer_generation_fallback fires, the `validate_answer` condition block evaluates `<Answer Generator.content>` — an empty string fails the `length >= 10` check, causing the condition to route via `condition-invalid` to `metrics_collector`, automatically skipping the send. Fallback return values are not consumed by downstream blocks; they serve to prevent loop crashes and log errors. See [Section 7.1 Error Handling Notes](#71-error-scenarios-and-responses) for details.

#### Block 9: Validate Answer (Condition — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `condition` |
| **Parent** | `question_loop` |
| **Purpose** | Validates AI-generated answer meets Trendyol's 10–2000 character requirement before sending; routes valid/invalid answers to different downstream blocks |
| **Conditions** | See below |
| **Output Handles** | `condition-valid` → `escape_answer_text`, `condition-invalid` → `metrics_collector` |

**Condition Configuration:**

```javascript
// Condition array for validate_answer block
[
  {
    "id": "valid",
    "title": "if",
    "value": "<Answer Generator.content> && <Answer Generator.content>.trim().length >= 10 && <Answer Generator.content>.trim().length <= 2000"
  },
  {
    "id": "invalid",
    "title": "else",
    "value": ""
  }
]
```

> **Routing**:
> - `condition-valid` handle → edge to `escape_answer_text` (answer passes length validation, escape before sending)
> - `condition-invalid` handle → edge to `metrics_collector` (answer too short, too long, or empty — skip sending)

#### Block 10: Escape Answer Text (Function — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `function` |
| **Parent** | `question_loop` |
| **Purpose** | JSON-escapes the AI-generated answer text to prevent JSON injection when interpolated into Send Answer's request body |
| **Code** | See below |
| **Output** | `{ escapedText: "..." }` |

```javascript
// escape_answer_text function code
// Properly escape the answer text for safe JSON string interpolation
const text = <Answer Generator.content> || "";
const escaped = text
  .replace(/\\/g, '\\\\')
  .replace(/"/g, '\\"')
  .replace(/\n/g, '\\n')
  .replace(/\r/g, '\\r')
  .replace(/\t/g, '\\t');
return { escapedText: escaped };
```

#### Block 11: Send Answer (API — inside loop, DISABLED)

| Property | Value |
|----------|-------|
| **Type** | `api` |
| **Parent** | `question_loop` |
| **Enabled** | `false` ⚠️ **DISABLED for testing** |
| **Method** | `POST` |
| **URL** | `https://apigw.trendyol.com/integration/qna/sellers/<variable.supplierId>/questions/<loop.item.id>/answers` |
| **Headers** | `[["Authorization", "{{TRENDYOL_AUTH_HEADER}}"], ["Content-Type", "application/json"], ["User-Agent", "<variable.userAgent>"]]` |
| **Body** | `{"text": "<Escape Answer Text.escapedText>"}` |
| **Timeout** | `15000` (15 seconds) |
| **Output** | `.status` → 200 on success |
| **Error Handling** | Error port edge (`sourceHandle: "error"`) → `send_answer_fallback` block |

> **JSON Safety**: The body uses `<Escape Answer Text.escapedText>` — the pre-escaped answer text from the Escape Answer Text function block. This prevents JSON injection when the AI-generated text contains double quotes, newlines, or other special characters.

#### Block 12: Send Answer Fallback (Function — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `function` |
| **Parent** | `question_loop` |
| **Purpose** | Catches errors from Send Answer; logs error and allows loop to continue |
| **Code** | See below |
| **Output** | `{ success: false, error: true, message: "..." }` |

```javascript
// send_answer_fallback function code
// Fallback when send fails — log error and allow loop to continue
console.error("Send answer failed");
return {
  success: false,
  error: true,
  message: "Send answer failed"
};
```

> **Fallback Design Note**: Fallback blocks prevent loop crashes and log errors. Their return values are not consumed by downstream blocks; instead, blocks referencing the original failed block (e.g., `<Send Answer.status>`) receive `undefined` for missing fields. See [Section 7.1 Error Handling Notes](#71-error-scenarios-and-responses) for details.

#### Block 13: Metrics Collector (Function — inside loop)

| Property | Value |
|----------|-------|
| **Type** | `function` |
| **Parent** | `question_loop` |
| **Purpose** | Tracks per-iteration metrics for monitoring and observability |
| **Code** | See below |
| **Output** | `{ metrics: { ... } }` |

```javascript
// metrics_collector function code
// Collect metrics for observability using tag references
const questionId = <loop.item.id> || null;
const productData = <Fetch Product.data> || {};
const answerText = <Answer Generator.content> || "";

return {
  metrics: {
    questionId: questionId,
    productFetchAttempted: true,
    productFound: (productData.content && productData.content.length > 0),
    answerGenerated: (answerText.trim().length > 0),
    answerLength: answerText.trim().length,
    timestamp: new Date().toISOString()
  }
};
```

> **Metrics note**: `<Fetch Product.data>` resolves to the API response body directly (e.g., `{ content: [], totalElements: 0 }`), NOT a nested object. Access `productData.content` (not `productData.data.content`). The Metrics Collector runs at the end of each loop iteration and captures per-question results. Aggregate metrics (questions_fetched, products_found, answers_generated, answers_sent, errors_encountered) can be computed from `<Question Loop.results>` in the Workflow Result response block.

#### Block 14: Workflow Result (Response)

| Property | Value |
|----------|-------|
| **Type** | `response` |
| **dataMode** | `"json"` |
| **data** | `<Question Loop.results>` |
| **status** | `"200"` |
| **Purpose** | Return loop results for monitoring/debugging |

---

## 3. Variable Definitions

> ⚠️ **SECURITY NOTE**: Credentials must be stored as environment variables, NOT workflow variables. Never store API keys, secrets, or auth headers in plain-text workflow variables.

| # | Variable Name | Type | Initial Value | Usage |
|---|--------------|------|---------------|-------|
| 1 | `supplierId` | `string` | `""` | Trendyol seller/supplier ID — used in all API URLs |
| 2 | `userAgent` | `string` | `"{supplierId} - SelfIntegration"` | Trendyol-recommended User-Agent format |

### 3.1 Variable Details

#### `supplierId`
- **Where used**: URL path for all 3 Trendyol API calls
- **Format**: Numeric string (e.g., `"123456"`)
- **How set**: Manually by user in Sim UI or via environment variable
- **Example**: `"987654"`

#### `userAgent`
- **Where used**: `User-Agent` header for all Trendyol API calls
- **Format**: `"{supplierId} - SelfIntegration"` (Trendyol's recommended format)
- **Example**: `"987654 - SelfIntegration"`

### 3.2 Authentication (Environment Variables)

All Trendyol API authentication is handled via environment variables:

| Environment Variable | Purpose | Format |
|---------------------|---------|--------|
| `{{TRENDYOL_AUTH_HEADER}}` | Pre-computed Basic Auth header | `Basic dXNlcm5hbWU6cGFzc3dvcmQ=` (Base64 of `apiKey:apiSecret`) |

**Why pre-computed auth header?** Trendyol uses HTTP Basic Authentication. Pre-computing the `Basic {base64(apiKey:apiSecret)}` header avoids needing a function block for Base64 encoding. The header is stored as an environment variable (`{{TRENDYOL_AUTH_HEADER}}`) — never as a plain-text workflow variable.

> **Removed**: The previous `authHeader` workflow variable has been replaced with `{{TRENDYOL_AUTH_HEADER}}` environment variable. Use `{{TRENDYOL_AUTH_HEADER}}` in all `Authorization` headers.

---

## 4. API Call Specifications

### 4.1 Fetch Unanswered Questions

```
Block: Fetch Questions
Method: GET
URL: https://apigw.trendyol.com/integration/qna/sellers/{supplierId}/questions/filter
     ?status=WAITING_FOR_ANSWER
     &size=25
     &page=0

Headers:
  Authorization: {{TRENDYOL_AUTH_HEADER}}
  Content-Type: application/json
  User-Agent: {supplierId} - SelfIntegration

Success Response (200):
{
  "page": 0,
  "size": 25,
  "totalElements": 12,
  "totalPages": 1,
  "content": [
    {
      "id": 55545,
      "text": "Bu ürün Bluetooth 5.0 destekliyor mu?",
      "productName": "Kablosuz Kulaklık XYZ",
      "productMainId": "PROD-12345",
      "status": "WAITING_FOR_ANSWER",
      "customerId": 78910,
      "userName": "customer123",
      "creationDate": 1672531200000,
      "answer": null
    },
    ...
  ]
}

Error Responses:
  401 — Invalid credentials
  403 — Insufficient permissions
  429 — Rate limited
  500 — Server error

Rate Limits:
  - Standard supplier rate limits apply
  - Recommended: poll no more than once per 5 minutes
```

### 4.2 Fetch Product Details

> ⚠️ **IMPORTANT: Verify `productMainId` field**
> The official Trendyol API documentation for `/questions/filter` does not explicitly list `productMainId` in the response schema.
> Before deployment, call the API with valid credentials and inspect the actual response to confirm `productMainId` presence.
> If `productMainId` is absent or null, the workflow will fall back to answering without product context (graceful degradation via `product_fetch_fallback`).

```
Block: Fetch Product
Method: GET
URL: https://apigw.trendyol.com/integration/product/sellers/{supplierId}/products/approved
     ?productMainId={productMainId}

Headers:
  Authorization: {{TRENDYOL_AUTH_HEADER}}
  Content-Type: application/json
  User-Agent: {supplierId} - SelfIntegration

Success Response (200):
{
  "totalElements": 1,
  "totalPages": 1,
  "page": 0,
  "size": 50,
  "content": [
    {
      "id": "product_id",
      "approved": true,
      "barcode": "PROD-12345",
      "productMainId": "PROD-12345",
      "title": "Kablosuz Kulaklık XYZ Bluetooth 5.0",
      "brand": "MerkaMarka",
      "categoryName": "Elektronik > Kulaklık",
      "description": "Yüksek kaliteli Bluetooth 5.0 kulaklık...",
      "stockCode": "SKU-001",
      "listPrice": 599.99,
      "salePrice": 449.99,
      "vatRate": 18,
      "quantity": 150,
      "images": [...],
      "attributes": [
        { "attributeName": "Renk", "attributeValue": "Siyah" },
        { "attributeName": "Bağlantı", "attributeValue": "Bluetooth 5.0" }
      ]
    }
  ]
}

Error Responses:
  200 with empty content[] — Product not found (not a hard error)
  401 — Invalid credentials
  404 — Invalid seller ID

Error Handling:
  Error port edge (sourceHandle: "error") → product_fetch_fallback block.
  Fallback prevents loop crash and logs the error. The AI agent receives
  undefined for <Fetch Product.data> and answers using the question text
  and productName from the question object (graceful degradation).

Notes:
  - Uses the Approved Products v2 endpoint (/products/approved) with productMainId parameter
  - Previous barcode-based lookup was incorrect; productMainId is the correct filter
  - If content is empty, AI agent should still answer using just the question text
```

### 4.3 Send Answer

```
Block: Send Answer (DISABLED for testing)
Method: POST
URL: https://apigw.trendyol.com/integration/qna/sellers/{supplierId}/questions/{questionId}/answers

Headers:
  Authorization: {{TRENDYOL_AUTH_HEADER}}
  Content-Type: application/json
  User-Agent: {supplierId} - SelfIntegration

Request Body:
{
  "text": "AI-generated answer (validated: 10-2000 characters)"
}

Success Response (200):
  Answer submitted successfully, pending Trendyol moderation.

Error Responses:
  400 — Answer too short (<10 chars) or too long (>2000 chars)
  401 — Invalid credentials
  404 — Question not found or already answered
  409 — Question already has an answer
  429 — Rate limited

Validation Rules:
  - Answer text must be 10-2000 characters
  - Answer will be reviewed by Trendyol before publishing
  - Duplicate answers to same question are rejected
```

---

## 5. Loop + AI Integration Flow

### 5.1 Detailed Data Flow Through Loop

```
LOOP START: forEach over <Fetch Questions.data.content>
  Current item available as: <loop.item>

  ITERATION N:
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  1. Extract question data from <loop.item>:                     │
  │     - questionId:    <loop.item.id>        → 55545             │
  │     - questionText:  <loop.item.text>      → "Bu ürün..."     │
  │     - productName:   <loop.item.productName> → "Kulaklık XYZ" │
  │     - productMainId: <loop.item.productMainId> → "PROD-12345" │
  │     - customerName:  <loop.item.userName>  → "customer123"    │
  │                                                                 │
  │  2. Fetch Product API:                                          │
  │     URL: .../products/approved?productMainId=<loop.item.       │
  │          productMainId>                                         │
  │     → SUCCESS: <Fetch Product.data.content[0]>                  │
  │       title: "Kablosuz Kulaklık XYZ Bluetooth 5.0"             │
  │       brand: "MerkaMarka"                                       │
  │       description: "Yüksek kaliteli..."                        │
  │       attributes: [{Renk: Siyah}, {Bağlantı: BT 5.0}]        │
  │       salePrice: 449.99                                        │
  │     → ERROR: product_fetch_fallback runs                        │
  │       returns { data: { content: [] } }                         │
  │       AI agent proceeds with question text only                 │
  │                                                                 │
  │  3. AI Agent receives:                                          │
  │     SYSTEM: E-commerce support expert prompt                    │
  │     USER: "Question: <loop.item.text>                          │
  │            Product: <loop.item.productName>                     │
  │            Details: <Fetch Product.data>"                      │
  │     → SUCCESS: <Answer Generator.content>                       │
  │       "Evet, bu kulaklık Bluetooth 5.0..."                     │
  │     → ERROR: answer_generation_fallback runs                    │
  │       returns { content: "", error: true }                      │
  │       → validate_answer will reject (too short) → skip send    │
  │                                                                 │
  │  4. Validate Answer (Condition block):                          │
  │     Condition: <Answer Generator.content>.trim().length         │
  │       >= 10 AND <= 2000                                        │
  │     → condition-valid: proceed to Escape Answer Text            │
  │     → condition-invalid: skip Send Answer, go to metrics       │
  │                                                                 │
  │  5. Escape Answer Text (Function block, for valid answers):     │
  │     Escapes special chars (\, ", \n, \r, \t) in AI text         │
  │     → { escapedText: "..." }                                    │
  │                                                                 │
  │  6. Send Answer API (when enabled, only for valid answers):     │
  │     POST .../questions/<loop.item.id>/answers                   │
  │     Body: {"text": "<Escape Answer Text.escapedText>"}          │
  │     → SUCCESS: 200 OK                                           │
  │     → ERROR: send_answer_fallback runs                          │
  │       returns { success: false, error: true }                   │
  │       loop continues to next iteration                          │
  │                                                                 │
  │  7. Metrics Collector:                                          │
  │     Tracks: productFound, answerGenerated, answerValid,         │
  │             answerSent, errorEncountered                         │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘

LOOP END → <Question Loop.results> (array of per-iteration outputs)
```

### 5.2 AI Agent Prompt Design

#### System Message

```
You are a professional e-commerce customer support specialist for a Trendyol marketplace seller.

Your job is to answer customer product questions accurately and helpfully.

## Rules:
1. Answer in Turkish (the customer's language) unless the question is in another language
2. Be polite, concise, and factual
3. Use the provided product details to give accurate answers
4. If the product details don't contain enough information to answer, give a helpful general response and suggest the customer contact the seller directly
5. Keep answers between 10 and 2000 characters (Trendyol API requirement)
6. Do NOT include greetings like "Merhaba" at the start — Trendyol adds these automatically
7. Do NOT make up specifications or features not found in the product data
8. Do NOT mention prices unless specifically asked
9. Do NOT include markdown formatting — plain text only
10. If the question is about shipping, returns, or warranty, provide a general helpful response

## Response format:
Respond with ONLY the answer text. No JSON, no labels, no prefixes.
```

#### User Message Template

```
Customer Question: <loop.item.text>

Product Name: <loop.item.productName>

Product Details:
<Fetch Product.data>

Please provide a helpful, accurate answer to the customer's question based on the product information above.
```

### 5.3 Agent Configuration Details (Synced with Kamatas PROD)

| SubBlock | Value | Notes |
|----------|-------|-------|
| `model` | `openrouter/openai/gpt-5.1-codex-mini` | Synced with Kamatas PROD; OpenRouter-hosted model |
| `apiKey` | `{{OPENROUTER_API_KEY}}` | Environment variable (OpenRouter API key) |
| `temperature` | _not set_ | Uses model default; matches Kamatas PROD (null) |
| `messages` | See above | System + user message with tag references |
| `tools` | _none_ | Single-shot Q&A; no browsing/handoff tools needed |
| `memoryType` | _none_ | No conversation memory (each question is independent) |
| `responseFormat` | _none_ | Plain text answer output |

> **Kamatas PROD Reference** (workflow `98c363ef-febc-42cc-82d2-d40b501c5b56`):
> The Kamatas production agent uses the same model (`openrouter/openai/gpt-5.1-codex-mini`) with these additional features not needed for Trendyol Q&A:
> - **5 custom tools**: `handoff_to_human`, `ikas_browse`, `ikas_lookup_customer_orders`, `calculate_product_price`, `get_products_by_main_category`
> - **Sliding-window memory**: size 15, with `conversationId` for multi-turn WhatsApp conversations
> - **Structured response format**: `{ response: string }` JSON schema
> - **Skills**: None configured in workspace

---

## 6. Testing Strategy

> ⚠️ **CRITICAL DEPLOYMENT SAFETY WARNING**
> 
> **Schedule trigger runs against the deployed workflow state, NOT the draft state.** Manual test executions (via `execute_workflow`) use the draft state and respect block toggles.
> 
> **Never enable Send Answer in the deployed state during testing.** Only deploy with Send Answer enabled after Phase 2 testing is complete and verified.
> 
> - Draft state: Used by `execute_workflow` MCP calls. Block toggle changes (enable/disable) take effect immediately.
> - Deployed state: Used by schedule trigger. Only updated when you explicitly deploy. Send Answer must remain disabled in the deployed snapshot until Phase 2 is complete.

### 6.1 Phase 1: Safe Validation (No Trendyol writes)

**Prerequisites:**
- Set valid `supplierId` variable and `{{TRENDYOL_AUTH_HEADER}}` environment variable
- Set `userAgent` variable
- **`Send Answer` block is DISABLED** (toggle_block_enabled: false)

**Expected behavior:**
- No answers are sent to Trendyol
- AI responses are generated and visible in trace spans
- Product data is fetched and enriched in AI context
- Validate Answer block output shows valid/invalid for each answer
- Error fallback blocks catch any API/agent failures gracefully

**Test Steps:**

| # | Test | Expected Result | How to Verify |
|---|------|----------------|---------------|
| 1 | Execute workflow manually | Fetches questions from Trendyol API | Check trace span for `Fetch Questions` — status 200 |
| 2 | Verify question data | `content` array contains question objects | Inspect `Fetch Questions.data.content` in trace |
| 3 | Condition routing | If questions exist → enters loop | Check `Has Questions.conditionResult` is true |
| 4 | Condition routing (empty) | If no questions → skips loop | Test when no pending questions exist |
| 5 | Loop iteration | Loop processes each question | Check trace for multiple `Fetch Product` executions |
| 6 | Product enrichment | Product details fetched for each question (using `/approved` endpoint) | Verify `Fetch Product.data.content[0]` has product info |
| 7 | Product fetch error handling | Error port edge routes to fallback | Simulate product API failure; verify `product_fetch_fallback` runs |
| 8 | AI response generation | Agent generates Turkish answer | Verify `Answer Generator.content` is valid Turkish text |
| 9 | Answer validation | Validate Answer condition routes correctly | Verify `condition-valid` routes to escape_answer_text → send_answer, `condition-invalid` routes to metrics_collector |
| 10 | Send block skipped | `Send Answer` block not executed | Confirm block shows as disabled/skipped in trace |
| 11 | Metrics collected | Metrics block tracks iteration results | Verify `Metrics.metrics` contains expected fields |
| 12 | Response output | Loop results captured | Check `Workflow Result.data` contains all iteration results |

**Verification Commands:**
```
// Execute workflow
execute_workflow({ workflowId: "...", triggerType: "schedule" })

// Check logs with traces
get_execution_logs({
  workspaceId: "...",
  workflowId: "...",
  details: "full",
  includeTraceSpans: true,
  includeFinalOutput: true,
  limit: 1
})
```

### 6.2 Phase 2: Limited Send Testing

**Prerequisites:**
- Phase 1 passes completely
- Identify 1-2 test questions to answer
- Enable `Send Answer` block **in draft state only**: `toggle_block_enabled({ ..., blockId: "send_answer", enabled: true })`
- **Do NOT deploy** — use `execute_workflow` with `useDraftState: true`

**Test Steps:**

| # | Test | Expected Result |
|---|------|----------------|
| 1 | Single question run | Answer posted to Trendyol API |
| 2 | Verify response | API returns 200 |
| 3 | Check Trendyol dashboard | Answer appears under question (pending moderation) |
| 4 | Answer length validation | Validate Answer condition confirms 10-2000 characters before routing to send |
| 5 | Edge case: already answered | API returns 404 or 409 — send_answer_fallback catches error, loop continues |
| 6 | Edge case: invalid answer | Validate Answer condition routes to `condition-invalid`; metrics show iteration skipped |
| 7 | Error port edges | Verify error fallbacks fire correctly when API errors occur |

### 6.3 Phase 3: Production Deployment

**Prerequisites:**
- Phase 2 successful with multiple verified answers
- Schedule trigger configured (every 10 minutes)
- Monitoring in place
- **Only NOW deploy with Send Answer enabled**

**Monitoring Checklist:**

| Metric | Check |
|--------|-------|
| Execution frequency | Every 10 minutes |
| Success rate | >95% of executions succeed |
| Questions processed | Count per run (max 25) |
| AI response quality | Sample review of generated answers |
| Answer validation rate | % of answers routed via `condition-valid` handle |
| API errors | Track 4xx/5xx from Trendyol |
| Error fallback triggers | Count of product_fetch_fallback, answer_generation_fallback, send_answer_fallback fires |
| Cost tracking | Monitor LLM costs per execution |
| Answer moderation | Check Trendyol moderation rejection rate |
| Expected execution time | ~30–60 seconds for 25 questions |

---

## 7. Error Handling Matrix

### 7.1 Error Scenarios and Responses

| # | Scenario | Block Affected | Error Code | Handling Strategy | Workflow Continues? |
|---|----------|---------------|------------|-------------------|---------------------|
| 1 | No unanswered questions | Fetch Questions | 200 (empty content) | Condition routes to "no_questions" path → skip loop | ✅ Yes (no-op) |
| 2 | Invalid credentials | Fetch Questions | 401 | Workflow fails; check `{{TRENDYOL_AUTH_HEADER}}` environment variable | ❌ No (execution error) |
| 3 | Rate limited (questions) | Fetch Questions | 429 | Workflow fails; increase poll interval | ❌ No |
| 4 | Trendyol server error | Fetch Questions | 500 | Workflow fails; retry on next schedule | ❌ No |
| 5 | Product not found | Fetch Product | 200 (empty content) | Normal success — AI answers with limited context (productName from question) | ✅ Yes |
| 6 | Product API failure | Fetch Product | 4xx/5xx | Error port edge → `product_fetch_fallback` → returns `{ data: { content: [] } }` | ✅ Yes |
| 7 | AI agent error/timeout | Answer Generator | error/timeout | Error port edge → `answer_generation_fallback` → returns `{ content: "" }` → validate_answer condition rejects (too short) → `condition-invalid` → metrics | ✅ Yes (loop continues) |
| 8 | AI response too short | Validate Answer | — | `validate_answer` condition evaluates `false` → `condition-invalid` handle routes to `metrics_collector`, skipping send | ✅ Yes (loop continues) |
| 9 | AI response too long | Validate Answer | — | `validate_answer` condition evaluates `false` → `condition-invalid` handle routes to `metrics_collector`, skipping send | ✅ Yes (loop continues) |
| 10 | Question already answered | Send Answer | 404/409 | Error port edge → `send_answer_fallback` → logs error, returns `{ success: false }` | ✅ Yes (loop continues) |
| 11 | Answer rate limited | Send Answer | 429 | Error port edge → `send_answer_fallback` → logs error, remaining questions retry on next poll | ✅ Yes (loop continues) |
| 12 | Send API failure | Send Answer | 4xx/5xx | Error port edge → `send_answer_fallback` → logs error, returns `{ success: false }` | ✅ Yes (loop continues) |
| 13 | Network timeout | Any API block | timeout | Block-level timeout (15-30s); error port edge routes to respective fallback | ✅ Yes (for loop blocks) |

### Error Handling Notes

⚠️ **Fallback Block Design Pattern**: When a block fails (error port activates), the errored block's output stores `{ error: true, message: "..." }`. Downstream blocks that reference the original block (e.g., `<Fetch Product.data>`) receive `undefined` for missing fields, **NOT** the fallback block's return values. The fallback blocks serve two purposes:

1. **Prevent loop crash**: Error edges route to fallback blocks (instead of crashing), allowing the loop to continue to next iteration
2. **Log errors**: Fallback blocks log errors via `console.error()` for observability

The AI agent gracefully handles missing product data by answering with just the question text and productName from the question object. The `validate_answer` condition rejects empty AI responses. This creates a robust error chain where no single API failure crashes the workflow.

### 7.2 Error Handling Architecture: Error Port Edges

> **IMPORTANT**: This workflow does NOT use `continueOnError` (which does not exist in Sim Studio). Instead, error handling is implemented via **error port edges** — dedicated edge connections from each block's error output port (`sourceHandle: "error"`) to a fallback function block.

**Error Port Edge Configuration:**

| Source Block | Source Handle | Target Fallback Block | Fallback Behavior |
|-------------|---------------|----------------------|-------------------|
| `fetch_product` | `error` | `product_fetch_fallback` | Returns `{ data: { content: [] } }` — AI proceeds with question text only |
| `answer_generator` | `error` | `answer_generation_fallback` | Returns `{ content: "", error: true }` — validate_answer condition rejects (empty string fails length check), `condition-invalid` routes to metrics |
| `send_answer` | `error` | `send_answer_fallback` | Returns `{ success: false, error: true }` — loop continues to next question |

**Fallback Block Specifications:**

#### `product_fetch_fallback` (Function Block)
```javascript
// Catches fetch_product errors — return empty product data so AI continues
return {
  data: { content: [] },
  error: true,
  message: "Product fetch failed"
};
```
- **Purpose**: Ensures the AI agent can still generate an answer even when product details are unavailable
- **Output consumed by**: Not directly consumed — see [Error Handling Notes](#error-handling-notes). The AI agent references `<Fetch Product.data>` which resolves to `undefined` on error; the agent gracefully handles missing product data.

#### `answer_generation_fallback` (Function Block)
```javascript
// Catches answer_generator errors — return empty content that validation will reject
console.error("Answer generation failed");
return {
  content: "",
  error: true,
  message: "Answer generation failed",
  skip: true
};
```
- **Purpose**: Gracefully handles AI agent failures; empty content will be rejected by validate_answer
- **Output consumed by**: Not directly consumed — see [Error Handling Notes](#error-handling-notes). `validate_answer` references `<Answer Generator.content>` which resolves to an empty/error state on failure, causing `condition-invalid` routing.

#### `send_answer_fallback` (Function Block)
```javascript
// Catches send_answer errors — log error and allow loop to continue
console.error("Send answer failed");
return {
  success: false,
  error: true,
  message: "Send answer failed"
};
```
- **Purpose**: Ensures loop continues even when posting an answer fails
- **Output consumed by**: Not directly consumed — see [Error Handling Notes](#error-handling-notes). The loop continues to the next iteration after the fallback executes.

### 7.3 Graceful Degradation

```
Full context available:
  question + product details → best quality AI answer
  → validate_answer condition confirms 10-2000 chars → condition-valid
  → escape_answer_text JSON-escapes the text
  → send_answer posts to Trendyol

Partial context (product API failed):
  product_fetch_fallback prevents loop crash; AI references <Fetch Product.data> which is undefined
  → question text only → AI answers based on product name from question
  (productName is included in the question object itself)
  → validate_answer condition still checks length
  → escape_answer_text → send_answer posts if valid (condition-valid)

AI agent failed:
  answer_generation_fallback provides { content: "" }
  → validate_answer condition rejects (empty string, < 10 chars)
  → condition-invalid → metrics_collector records error
  → send_answer skipped

Send API failed:
  send_answer_fallback catches error
  → loop continues to next question
  → unanswered question retried on next poll

No questions:
  condition block routes to Response → clean exit, no errors
```

---

## 8. Key Decisions

### 8.1 Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Poll interval** | 10 minutes | Extended from 5 min to provide ample margin. Processing 25 questions takes ~30–60 seconds; 10 min avoids overlapping executions and respects API rate limits |
| **Batch size** | 25 (half of max) | Reduced from 50 to limit execution time to ~30–60 seconds per run and avoid schedule overlap |
| **AI model** | `openrouter/openai/gpt-5.1-codex-mini` | Synced with Kamatas PROD; OpenRouter-hosted; good quality for Turkish text |
| **Temperature** | _not set_ (model default) | Matches Kamatas PROD configuration (null/unset) |
| **Answer validation** | Condition block (10-2000 chars) | Routes valid answers to escape_answer_text → send_answer and invalid answers to metrics_collector via condition handles |
| **Trigger type** | `schedule` | Automated polling; no external webhook available from Trendyol for Q&A |
| **Product lookup** | By `productMainId` on `/approved` endpoint | Uses the Approved Products v2 API with `productMainId` filter (not `barcode`) |
| **Auth storage** | Environment variable `{{TRENDYOL_AUTH_HEADER}}` | Security best practice — never store credentials in plain-text workflow variables |
| **Error handling** | Error port edges to fallback blocks | Uses Sim's native error port edges (`sourceHandle: "error"`) instead of non-existent `continueOnError` |
| **Loop type** | `forEach` | Natural fit for iterating over question array |
| **Send block disabled** | Default disabled | Safety: prevents accidental auto-posting during development and testing |

### 8.2 Future Enhancements

| Enhancement | Description | Priority |
|-------------|-------------|----------|
| ~~**Answer quality check**~~ | ~~Add a condition block after AI agent to validate answer length (10-2000 chars)~~ | ✅ **IMPLEMENTED** — `validate_answer` block |
| ~~**Metrics tracking**~~ | ~~Add function block to count questions processed~~ | ✅ **IMPLEMENTED** — `metrics_collector` block |
| **Duplicate detection** | Track answered question IDs to avoid re-processing | Low |
| **Multi-page pagination** | Fetch additional pages if totalPages > 1 | Low (25 questions per 10 min is sufficient) |
| **Answer review (HITL)** | Add human-in-the-loop block before Send Answer for manual approval | Medium |
| **Knowledge base** | Add a knowledge block with product FAQ data for better AI context | High |
| **Retry logic** | Add wait + retry for rate-limited API calls | Medium |
| **Answer caching** | Cache frequently asked questions and their answers | Low |

---

## 9. Workflow JSON Structure

### 9.1 Build Sequence (MCP Operations)

```javascript
// ============================================================
// STEP 1: Create Workflow
// ============================================================
create_workflow({
  name: "Trendyol Q&A Auto-Response",
  workspaceId: "<WORKSPACE_ID>",
  description: "Automatically answers unanswered Trendyol customer questions using AI"
})
// → workflowId

// ============================================================
// STEP 2: Add Variables
// NOTE: Credentials use environment variables, NOT workflow variables.
//       Use {{TRENDYOL_AUTH_HEADER}} in Authorization headers.
// ============================================================
add_variable({ workflowId, name: "supplierId", type: "string", value: "" })
add_variable({ workflowId, name: "userAgent", type: "string", value: "" })

// ============================================================
// STEP 3: Add All Blocks (14 total)
// ============================================================
add_blocks({
  workflowId,
  blocks: [
    // Trigger
    {
      id: "scheduler",
      type: "schedule",
      name: "Scheduler",
      position: { x: 100, y: 300 }
    },
    // Fetch questions
    {
      id: "fetch_questions",
      type: "api",
      name: "Fetch Questions",
      position: { x: 400, y: 300 }
    },
    // Condition: has questions?
    {
      id: "has_questions",
      type: "condition",
      name: "Has Questions",
      position: { x: 700, y: 300 }
    },
    // Loop container
    {
      id: "question_loop",
      type: "loop",
      name: "Question Loop",
      position: { x: 1000, y: 300 }
    },
    // Fetch product (inside loop)
    {
      id: "fetch_product",
      type: "api",
      name: "Fetch Product",
      position: { x: 1100, y: 250 }
    },
    // Product fetch fallback (inside loop)
    {
      id: "product_fetch_fallback",
      type: "function",
      name: "Product Fetch Fallback",
      position: { x: 1100, y: 450 }
    },
    // AI agent (inside loop)
    {
      id: "answer_generator",
      type: "agent",
      name: "Answer Generator",
      position: { x: 1400, y: 250 }
    },
    // Answer generation fallback (inside loop)
    {
      id: "answer_generation_fallback",
      type: "function",
      name: "Answer Generation Fallback",
      position: { x: 1400, y: 450 }
    },
    // Validate answer (inside loop — CONDITION block)
    {
      id: "validate_answer",
      type: "condition",
      name: "Validate Answer",
      position: { x: 1700, y: 250 }
    },
    // Escape answer text for JSON safety (inside loop)
    {
      id: "escape_answer_text",
      type: "function",
      name: "Escape Answer Text",
      position: { x: 1700, y: 350 }
    },
    // Send answer (inside loop, DISABLED)
    {
      id: "send_answer",
      type: "api",
      name: "Send Answer",
      position: { x: 2000, y: 200 },
      enabled: false
    },
    // Send answer fallback (inside loop)
    {
      id: "send_answer_fallback",
      type: "function",
      name: "Send Answer Fallback",
      position: { x: 2000, y: 450 }
    },
    // Metrics collector (inside loop)
    {
      id: "metrics_collector",
      type: "function",
      name: "Metrics",
      position: { x: 2300, y: 250 }
    },
    // Response
    {
      id: "workflow_result",
      type: "response",
      name: "Workflow Result",
      position: { x: 2600, y: 300 }
    }
  ]
})

// ============================================================
// STEP 4: Set Block Parents (nest inside loop — 9 blocks)
// ============================================================
update_block_parent({ workflowId, blockId: "fetch_product", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "product_fetch_fallback", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "answer_generator", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "answer_generation_fallback", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "validate_answer", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "escape_answer_text", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "send_answer", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "send_answer_fallback", parentId: "question_loop" })
update_block_parent({ workflowId, blockId: "metrics_collector", parentId: "question_loop" })

// ============================================================
// STEP 5: Add Edges (19 total — including error port edges, condition routing, and escape routing)
// ============================================================

// --- Main flow edges (outside loop) ---
// E1: Scheduler → Fetch Questions
add_edge({ workflowId, source: "scheduler", target: "fetch_questions" })

// E2: Fetch Questions → Has Questions
add_edge({ workflowId, source: "fetch_questions", target: "has_questions" })

// E3: Has Questions → Question Loop (if questions exist)
add_edge({
  workflowId,
  source: "has_questions",
  target: "question_loop",
  sourceHandle: "condition-has_questions"
})

// E4: Has Questions → Workflow Result (if no questions)
add_edge({
  workflowId,
  source: "has_questions",
  target: "workflow_result",
  sourceHandle: "condition-no_questions"
})

// --- Loop internal edges (happy path) ---
// E5: Question Loop → Fetch Product (loop entry)
add_edge({ workflowId, source: "question_loop", target: "fetch_product" })

// E6: Fetch Product → Answer Generator (success path)
add_edge({ workflowId, source: "fetch_product", target: "answer_generator" })

// E7: Answer Generator → Validate Answer (success path)
add_edge({ workflowId, source: "answer_generator", target: "validate_answer" })

// E8: Validate Answer → Escape Answer Text (valid answer — condition-valid handle)
add_edge({
  workflowId,
  source: "validate_answer",
  target: "escape_answer_text",
  sourceHandle: "condition-valid"
})

// E8.5: Escape Answer Text → Send Answer (escaped text ready for JSON body)
add_edge({ workflowId, source: "escape_answer_text", target: "send_answer" })

// E9: Validate Answer → Metrics (invalid answer — condition-invalid handle)
add_edge({
  workflowId,
  source: "validate_answer",
  target: "metrics_collector",
  sourceHandle: "condition-invalid"
})

// E10: Send Answer → Metrics (after successful send)
add_edge({ workflowId, source: "send_answer", target: "metrics_collector" })

// --- Error port edges (fallback paths) ---
// E11: Fetch Product error → Product Fetch Fallback
add_edge({
  workflowId,
  source: "fetch_product",
  target: "product_fetch_fallback",
  sourceHandle: "error"
})

// E12: Product Fetch Fallback → Answer Generator (continue with empty product data)
add_edge({ workflowId, source: "product_fetch_fallback", target: "answer_generator" })

// E13: Answer Generator error → Answer Generation Fallback
add_edge({
  workflowId,
  source: "answer_generator",
  target: "answer_generation_fallback",
  sourceHandle: "error"
})

// E14: Answer Generation Fallback → Validate Answer (empty content → will be rejected)
add_edge({ workflowId, source: "answer_generation_fallback", target: "validate_answer" })

// E15: Send Answer error → Send Answer Fallback
add_edge({
  workflowId,
  source: "send_answer",
  target: "send_answer_fallback",
  sourceHandle: "error"
})

// E16: Send Answer Fallback → Metrics (log the error)
add_edge({ workflowId, source: "send_answer_fallback", target: "metrics_collector" })

// --- Loop exit edge ---
// E17: Question Loop → Workflow Result (after loop completes)
add_edge({ workflowId, source: "question_loop", target: "workflow_result" })

// ============================================================
// STEP 6: Configure Loop Subflow
// ============================================================
update_subflow({
  workflowId,
  id: "question_loop",
  type: "loop",
  config: {
    loopType: "forEach",
    forEachItems: "<Fetch Questions.data.content>"
    // Note: forEach iterates over entire array. Batch size controlled by API size=25 parameter.
    // maxIterations is not used for forEach loops — Sim iterates over the full array.
  }
})

// ============================================================
// STEP 7: Configure Schedule Trigger (every 10 minutes)
// ============================================================
update_subblock({ workflowId, blockId: "scheduler", subblockId: "scheduleType", value: "custom" })
update_subblock({ workflowId, blockId: "scheduler", subblockId: "cronExpression", value: "*/10 * * * *" })
update_subblock({ workflowId, blockId: "scheduler", subblockId: "timezone", value: "Europe/Istanbul" })

// ============================================================
// STEP 8: Configure Fetch Questions API (size=25, env var auth)
// ============================================================
update_subblock({ workflowId, blockId: "fetch_questions", subblockId: "method", value: "GET" })
update_subblock({
  workflowId, blockId: "fetch_questions", subblockId: "url",
  value: "https://apigw.trendyol.com/integration/qna/sellers/<variable.supplierId>/questions/filter?status=WAITING_FOR_ANSWER&size=25"
})
update_subblock({
  workflowId, blockId: "fetch_questions", subblockId: "headers",
  value: [
    ["Authorization", "{{TRENDYOL_AUTH_HEADER}}"],
    ["Content-Type", "application/json"],
    ["User-Agent", "<variable.userAgent>"]
  ]
})
update_subblock({ workflowId, blockId: "fetch_questions", subblockId: "timeout", value: 30000 })

// ============================================================
// STEP 9: Configure Condition
// ============================================================
update_subblock({
  workflowId, blockId: "has_questions", subblockId: "conditions",
  value: [
    {
      "id": "has_questions",
      "title": "if",
      "value": "<Fetch Questions.data.content> && <Fetch Questions.data.content>.length > 0"
    },
    {
      "id": "no_questions",
      "title": "else",
      "value": ""
    }
  ]
})

// ============================================================
// STEP 10: Configure Fetch Product API (CORRECTED URL + env var auth)
// Uses /products/approved endpoint with productMainId parameter
// ============================================================
update_subblock({ workflowId, blockId: "fetch_product", subblockId: "method", value: "GET" })
update_subblock({
  workflowId, blockId: "fetch_product", subblockId: "url",
  value: "https://apigw.trendyol.com/integration/product/sellers/<variable.supplierId>/products/approved?productMainId=<loop.item.productMainId>"
})
update_subblock({
  workflowId, blockId: "fetch_product", subblockId: "headers",
  value: [
    ["Authorization", "{{TRENDYOL_AUTH_HEADER}}"],
    ["Content-Type", "application/json"],
    ["User-Agent", "<variable.userAgent>"]
  ]
})
update_subblock({ workflowId, blockId: "fetch_product", subblockId: "timeout", value: 15000 })

// ============================================================
// STEP 11: Configure Product Fetch Fallback (function block)
// ============================================================
update_subblock({
  workflowId, blockId: "product_fetch_fallback", subblockId: "code",
  value: `// Fallback when product fetch fails — return empty product data so AI continues
return {
  data: { content: [] },
  error: true,
  message: "Product fetch failed"
};`
})

// ============================================================
// STEP 12: Configure AI Agent (inside loop — synced with Kamatas PROD)
// Model and API key match Kamatas PROD workflow (98c363ef-...)
// No tools, memory, or response format needed for single-shot Q&A
// ============================================================
update_subblock({ workflowId, blockId: "answer_generator", subblockId: "model", value: "openrouter/openai/gpt-5.1-codex-mini" })
update_subblock({ workflowId, blockId: "answer_generator", subblockId: "apiKey", value: "{{OPENROUTER_API_KEY}}" })
// temperature: NOT SET (matches Kamatas PROD — uses model default)
update_subblock({
  workflowId, blockId: "answer_generator", subblockId: "messages",
  value: [
    {
      "role": "system",
      "content": "You are a professional e-commerce customer support specialist for a Trendyol marketplace seller.\n\nYour job is to answer customer product questions accurately and helpfully.\n\n## Rules:\n1. Answer in Turkish (the customer's language) unless the question is in another language\n2. Be polite, concise, and factual\n3. Use the provided product details to give accurate answers\n4. If the product details don't contain enough information to answer, give a helpful general response and suggest the customer contact the seller directly\n5. Keep answers between 10 and 2000 characters (Trendyol API requirement)\n6. Do NOT include greetings like \"Merhaba\" at the start — Trendyol adds these automatically\n7. Do NOT make up specifications or features not found in the product data\n8. Do NOT mention prices unless specifically asked\n9. Do NOT include markdown formatting — plain text only\n10. If the question is about shipping, returns, or warranty, provide a general helpful response\n\n## Response format:\nRespond with ONLY the answer text. No JSON, no labels, no prefixes."
    },
    {
      "role": "user",
      "content": "Customer Question: <loop.item.text>\n\nProduct Name: <loop.item.productName>\n\nProduct Details:\n<Fetch Product.data>\n\nPlease provide a helpful, accurate answer to the customer's question based on the product information above."
    }
  ]
})

// ============================================================
// STEP 13: Configure Answer Generation Fallback (function block)
// ============================================================
update_subblock({
  workflowId, blockId: "answer_generation_fallback", subblockId: "code",
  value: `// Fallback when AI agent fails — return empty content that validation will reject
console.error("Answer generation failed");
return {
  content: "",
  error: true,
  message: "Answer generation failed",
  skip: true
};`
})

// ============================================================
// STEP 14: Configure Validate Answer (CONDITION block — routes valid/invalid)
// ============================================================
update_subblock({
  workflowId, blockId: "validate_answer", subblockId: "conditions",
  value: [
    {
      "id": "valid",
      "title": "if",
      "value": "<Answer Generator.content> && <Answer Generator.content>.trim().length >= 10 && <Answer Generator.content>.trim().length <= 2000"
    },
    {
      "id": "invalid",
      "title": "else",
      "value": ""
    }
  ]
})

// ============================================================
// STEP 14.5: Configure Escape Answer Text (function block — JSON safety)
// ============================================================
update_subblock({
  workflowId, blockId: "escape_answer_text", subblockId: "code",
  value: `// Properly escape the answer text for safe JSON string interpolation
const text = <Answer Generator.content> || "";
const escaped = text
  .replace(/\\\\/g, '\\\\\\\\')
  .replace(/"/g, '\\\\"')
  .replace(/\\n/g, '\\\\n')
  .replace(/\\r/g, '\\\\r')
  .replace(/\\t/g, '\\\\t');
return { escapedText: escaped };`
})

// ============================================================
// STEP 15: Configure Send Answer API (inside loop, DISABLED, env var auth)
// Uses escaped text from Escape Answer Text block for JSON safety
// ============================================================
update_subblock({ workflowId, blockId: "send_answer", subblockId: "method", value: "POST" })
update_subblock({
  workflowId, blockId: "send_answer", subblockId: "url",
  value: "https://apigw.trendyol.com/integration/qna/sellers/<variable.supplierId>/questions/<loop.item.id>/answers"
})
update_subblock({
  workflowId, blockId: "send_answer", subblockId: "headers",
  value: [
    ["Authorization", "{{TRENDYOL_AUTH_HEADER}}"],
    ["Content-Type", "application/json"],
    ["User-Agent", "<variable.userAgent>"]
  ]
})
update_subblock({
  workflowId, blockId: "send_answer", subblockId: "body",
  value: "{\"text\": \"<Escape Answer Text.escapedText>\"}"
})
// JSON injection mitigated: The escape_answer_text function block (Step 14.5)
// pre-escapes special characters (\, ", \n, \r, \t) before interpolation.
update_subblock({ workflowId, blockId: "send_answer", subblockId: "timeout", value: 15000 })

// Ensure Send Answer is disabled for testing
toggle_block_enabled({ workflowId, blockId: "send_answer", enabled: false })

// ============================================================
// STEP 16: Configure Send Answer Fallback (function block)
// ============================================================
update_subblock({
  workflowId, blockId: "send_answer_fallback", subblockId: "code",
  value: `// Fallback when send fails — log error and allow loop to continue
console.error("Send answer failed");
return {
  success: false,
  error: true,
  message: "Send answer failed"
};`
})

// ============================================================
// STEP 17: Configure Metrics Collector (function block)
// ============================================================
update_subblock({
  workflowId, blockId: "metrics_collector", subblockId: "code",
  value: `// Collect metrics for observability using tag references
const questionId = <loop.item.id> || null;
const productData = <Fetch Product.data> || {};
const answerText = <Answer Generator.content> || "";

return {
  metrics: {
    questionId: questionId,
    productFetchAttempted: true,
    productFound: (productData.content && productData.content.length > 0),
    answerGenerated: (answerText.trim().length > 0),
    answerLength: answerText.trim().length,
    timestamp: new Date().toISOString()
  }
};`
})

// ============================================================
// STEP 18: Configure Response Block
// ============================================================
update_subblock({ workflowId, blockId: "workflow_result", subblockId: "dataMode", value: "json" })
update_subblock({
  workflowId, blockId: "workflow_result", subblockId: "data",
  value: "<Question Loop.results>"
})
update_subblock({ workflowId, blockId: "workflow_result", subblockId: "status", value: "200" })
```

### 9.2 Edge Summary

| # | Source | Target | Source Handle | Purpose |
|---|--------|--------|---------------|---------|
| 1 | `scheduler` | `fetch_questions` | — | Start → fetch |
| 2 | `fetch_questions` | `has_questions` | — | Fetch → condition |
| 3 | `has_questions` | `question_loop` | `condition-has_questions` | Yes → loop |
| 4 | `has_questions` | `workflow_result` | `condition-no_questions` | No → end |
| 5 | `question_loop` | `fetch_product` | — | Loop → first nested block |
| 6 | `fetch_product` | `answer_generator` | — | Product → AI (success path) |
| 7 | `answer_generator` | `validate_answer` | — | AI → validation (success path) |
| 8 | `validate_answer` | `escape_answer_text` | `condition-valid` | Valid answer → escape text |
| 8.5 | `escape_answer_text` | `send_answer` | — | Escaped text → send |
| 9 | `validate_answer` | `metrics_collector` | `condition-invalid` | Invalid answer → skip send, log metrics |
| 10 | `send_answer` | `metrics_collector` | — | After send → log metrics |
| 11 | `fetch_product` | `product_fetch_fallback` | `error` | **Error port** — product API failure |
| 12 | `product_fetch_fallback` | `answer_generator` | — | Fallback → continue to AI with empty product data |
| 13 | `answer_generator` | `answer_generation_fallback` | `error` | **Error port** — AI agent failure |
| 14 | `answer_generation_fallback` | `validate_answer` | — | Fallback → validate (empty → rejected) |
| 15 | `send_answer` | `send_answer_fallback` | `error` | **Error port** — send API failure |
| 16 | `send_answer_fallback` | `metrics_collector` | — | Fallback → log error in metrics |
| 17 | `question_loop` | `workflow_result` | — | Loop exit → response |

---

## 10. Implementation Checklist

### Phase 1: Create Workflow Structure
- [ ] Create workflow with `create_workflow`
- [ ] Add all 2 variables (`supplierId`, `userAgent`)
- [ ] Set `{{TRENDYOL_AUTH_HEADER}}` environment variable (NOT as workflow variable)
- [ ] Add all 14 blocks with `add_blocks`
- [ ] Create fallback function blocks with proper return structures (`product_fetch_fallback`, `answer_generation_fallback`, `send_answer_fallback`)
- [ ] Create escape function block (`escape_answer_text`) for JSON-safe text interpolation
- [ ] Create validation condition block (`validate_answer`) with `condition-valid`/`condition-invalid` routing
- [ ] Set parent relationships for 9 loop-nested blocks (all blocks inside `question_loop`)
- [ ] Add all ~19 edges (including 3 error port edges with `sourceHandle: "error"`, 2 condition edges with `condition-valid`/`condition-invalid`, and 2 escape routing edges)
- [ ] Configure loop subflow (forEach, array reference to `<Fetch Questions.data.content>`)

### Phase 2: Configure Blocks
- [ ] Configure Schedule trigger (cron `*/10 * * * *`, timezone)
- [ ] Configure Fetch Questions API (method, url with `size=25`, headers with `{{TRENDYOL_AUTH_HEADER}}`, timeout)
- [ ] Configure Has Questions condition (conditions array)
- [ ] Configure Fetch Product API (method, **corrected URL**: `/products/approved?productMainId=...`, headers with `{{TRENDYOL_AUTH_HEADER}}`, timeout)
- [ ] Configure Product Fetch Fallback function (returns `{ data: { content: [] } }`)
- [ ] Configure Answer Generator agent (model: `openrouter/openai/gpt-5.1-codex-mini`, apiKey: `{{OPENROUTER_API_KEY}}`, messages)
- [ ] Configure Answer Generation Fallback function (returns `{ content: "", error: true }`)
- [ ] Configure Validate Answer **condition** (conditions array with `condition-valid`/`condition-invalid` handles)
- [ ] Configure Send Answer API (method, url, headers with `{{TRENDYOL_AUTH_HEADER}}`, body uses `<Escape Answer Text.escapedText>`, timeout)
- [ ] Disable Send Answer block (`toggle_block_enabled: false`)
- [ ] ⚠️ **Do NOT enable Send Answer block until manual testing confirms error handling works**
- [ ] Configure Escape Answer Text function (JSON-escapes AI text for safe interpolation)
- [ ] Configure Send Answer Fallback function (returns `{ success: false, error: true }`)
- [ ] Configure Metrics Collector function (tracks per-iteration counts)
- [ ] Configure Workflow Result response (dataMode, data, status)

### Phase 3: Set Variables & Environment
- [ ] Set `supplierId` to actual Trendyol supplier ID
- [ ] Set `{{TRENDYOL_AUTH_HEADER}}` environment variable to `Basic {base64(apiKey:apiSecret)}`
- [ ] Set `userAgent` to `{supplierId} - SelfIntegration`
- [ ] Set `{{OPENROUTER_API_KEY}}` environment variable (OpenRouter API key, synced with Kamatas PROD)
- [ ] Verify NO plain-text credentials stored in workflow variables
- [ ] Deploy only after Phase 4 validation complete

### Phase 4: Test (Draft State Only)
- [ ] Execute workflow manually with schedule trigger (`useDraftState: true`)
- [ ] Verify Fetch Questions returns data (size=25)
- [ ] Verify condition routing works (both paths)
- [ ] Verify loop iterates over questions (max 25)
- [ ] Verify product details are fetched via `/products/approved` endpoint
- [ ] Verify error port edges work: simulate product API failure → fallback fires
- [ ] Verify AI generates appropriate Turkish responses
- [ ] Verify Validate Answer condition correctly routes: 10-2000 chars → `condition-valid`, else → `condition-invalid`
- [ ] Verify Send Answer block is skipped (disabled)
- [ ] Verify Metrics Collector tracks iteration results
- [ ] Review execution logs with trace spans
- [ ] ⚠️ CONFIRM: Send Answer is disabled in deployed snapshot

### Phase 5: Production Enable
- [ ] Deploy only after Phase 4 validation complete
- [ ] Enable Send Answer block **in draft state**
- [ ] Test with 1-2 questions via manual execution (draft state)
- [ ] Verify answers appear on Trendyol (pending moderation)
- [ ] Verify Validate Answer condition prevents invalid answers from reaching send
- [ ] Verify error fallbacks catch send failures gracefully
- [ ] **Only then**: Deploy workflow with Send Answer enabled
- [ ] Schedule becomes active on deployment
- [ ] Enable schedule trigger for production
- [ ] Monitor first few automated runs (10-minute intervals)
- [ ] Verify ~30-60 second execution time for 25 questions
- [ ] Set up alerting for execution failures

---

## Appendix A: Quick Reference

### Tag Syntax Used in This Workflow

| Tag | Resolves To | Used In |
|-----|------------|---------|
| `<variable.supplierId>` | Supplier ID string | All API URLs |
| `<variable.userAgent>` | `{id} - SelfIntegration` | All API headers |
| `<Fetch Questions.data.content>` | Array of question objects | Condition, Loop array |
| `<Fetch Questions.data.content>.length` | Number of questions | Condition expression |
| `<loop.item>` | Current question object | All loop-nested blocks |
| `<loop.item.id>` | Question ID | Send Answer URL |
| `<loop.item.text>` | Question text | AI agent user message |
| `<loop.item.productName>` | Product name | AI agent user message |
| `<loop.item.productMainId>` | Product main ID | Fetch Product URL (`productMainId` param) |
| `<loop.index>` | Current iteration (0-based) | Debugging |
| `<Fetch Product.data>` | Product API response body | AI agent user message |
| `<Answer Generator.content>` | AI-generated answer | Validate Answer condition input, Escape Answer Text input |
| `<Answer Generator.content>.trim().length` | Trimmed answer character count | Validate Answer condition expression |
| `<Escape Answer Text.escapedText>` | JSON-escaped answer text | Send Answer body |
| `<Question Loop.results>` | All loop iteration outputs | Workflow Result |

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `{{OPENROUTER_API_KEY}}` | OpenRouter API key for the AI agent (synced with Kamatas PROD) |
| `{{TRENDYOL_AUTH_HEADER}}` | Pre-computed Basic Auth header (`Basic {base64(apiKey:apiSecret)}`) — used in ALL Trendyol API `Authorization` headers |

> ⚠️ **Security**: All credentials are stored as environment variables. No plain-text secrets in workflow variables.

### Change Log

| Date | Change | Issue # |
|------|--------|---------|
| 2025-07-21 | Initial design | — |
| 2025-07-21 | **Critical fixes applied**: Removed non-existent `continueOnError`; added error port edges to fallback blocks; fixed Product API URL (`/products/approved?productMainId=`); added answer validation block; moved auth to env vars; reduced batch to 25; extended schedule to 10 min; added metrics collector; added deployment safety warnings | #1–#8 |
| 2025-07-21 | **Agent sync + condition block**: Synced agent block config with Kamatas PROD (model: `openrouter/openai/gpt-5.1-codex-mini`, API key: `{{OPENROUTER_API_KEY}}`); changed validate_answer from function block to condition block with `condition-valid`/`condition-invalid` routing handles; updated Send Answer body to use `<Answer Generator.content>`; updated implementation checklist with safety warnings; verified no skills needed | #7, #9 |
| 2025-07-22 | **Analyzer fixes applied**: (1) CRITICAL: All 4 function blocks rewritten to use tag references instead of non-existent `input` variable; (2) CRITICAL: JSON injection risk in Send Answer body documented with workaround; (3) HIGH: scheduleType corrected to `"custom"` throughout; (4) HIGH: `maxIterations: 25` removed (no-op for forEach); (5) HIGH: `productMainId` field verification warning added; (6) MEDIUM: Dead-code variables removed (`testMode`, `answeredCount`, `lastPollTimestamp`); (7) MEDIUM: Unused `TRENDYOL_PRODUCT_API_KEY` env var removed; (8) LOW: Edge count comment fixed (15→17) | Analyzer #1–#8 |
| 2025-07-23 | **Final blocking fixes** (v4.1): (1) JSON injection vulnerability mitigated — added `escape_answer_text` function block between Validate Answer and Send Answer; Send Answer body now uses `<Escape Answer Text.escapedText>` instead of raw AI text; (2) Fallback block dead-code pattern documented — added Error Handling Notes section explaining that fallback return values are not consumed by downstream blocks; updated all "Output consumed by" notes; (3) `metrics_collector` property path bug fixed — changed `productData.data.content` to `productData.content` (3 locations); (4) Edge count updated 17→19 with 2 new escape routing edges; (5) Block count updated 13→14; (6) Nested block count updated 8→9 | Final-fix #1–#3 |
