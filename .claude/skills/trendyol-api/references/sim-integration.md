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

const credentials = base64Encode('{{TRENDYOL_API_KEY}}' + ':' + '{{TRENDYOL_API_SECRET}}');

const status = params.status || 'WAITING_FOR_ANSWER';
const page = params.page || 0;

// Manual query string builder — URLSearchParams is NOT available in isolated-vm
function buildQueryString(paramsObj) {
  return Object.entries(paramsObj)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
    .join('&');
}

const queryObj = {
  status: status,
  size: '50',
  page: String(page),
  orderByField: 'CreatedDate',
  orderByDirection: 'DESC'
};

if (params.barcode) {
  queryObj.barcode = params.barcode;
}

const url = `https://apigw.trendyol.com/integration/qna/sellers/${sellerId}/questions/filter?${buildQueryString(queryObj)}`;

const response = await fetch(url, {
  method: 'GET',
  headers: {
    'Authorization': `Basic ${credentials}`,
    'Content-Type': 'application/json',
    'User-Agent': `${sellerId} - SelfIntegration`
  }
});

if (!response.ok) {
  return { error: `Trendyol API error: ${response.status}`, success: false };
}

const data = await response.json();

// Defensive null-check on data.content before mapping
const questions = (data && data.content) ? data.content : [];

return {
  success: true,
  questions: questions.map(q => ({
    id: q.id,
    question: q.text,
    product: q.productName,
    productId: q.productMainId,
    customer: q.userName,
    date: new Date(q.creationDate).toISOString(),
    status: q.status,
    imageUrl: q.imageUrl,
    hasRejectedAnswer: q.rejectedAnswer !== null,
    rejectionReason: q.rejectedAnswer ? q.rejectedAnswer.reason : null
  })),
  total: data.totalElements || 0,
  page: data.page || 0,
  totalPages: data.totalPages || 0
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

const credentials = base64Encode('{{TRENDYOL_API_KEY}}' + ':' + '{{TRENDYOL_API_SECRET}}');

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
    'Content-Type': 'application/json',
    'User-Agent': `${sellerId} - SelfIntegration`
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

Question: <loop.currentItem.question>
Product: <loop.currentItem.product>
Product ID: <loop.currentItem.productId>
```

---

## Using Question Data in Agent Blocks

Reference fetched question data using Sim's tag syntax:

```
Product: <functionBlock.output.questions[0].product>
Question: <functionBlock.output.questions[0].question>
Customer: <functionBlock.output.questions[0].customer>
```

Or in a loop context (inside a Loop block iterating over questions):
```
<loop.currentItem.question>
<loop.currentItem.product>
<loop.currentItem.id>
```
