# Sim Studio Integration

Custom tool schemas, workflow patterns, and agent prompts for integrating Trendyol Customer Questions API with Sim Studio.

## Custom Tool: Fetch Customer Questions

Create a custom tool named `trendyol_fetch_questions` in your Sim workspace.

### Schema

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

### Code

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

---

## Custom Tool: Answer Customer Question

Create a custom tool named `trendyol_answer_question`.

### Schema

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

### Code

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

---

## Workflow Pattern: Scheduled Question Answering

### Architecture

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

### Schedule Trigger Setup

- Use Sim's **Schedule** trigger type
- Set cron: `*/5 * * * *` (every 5 minutes)
- The trigger fires, executing the workflow automatically

### Agent Block Prompt (for answer generation)

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

---

## Using Question Data in Agent Blocks

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
