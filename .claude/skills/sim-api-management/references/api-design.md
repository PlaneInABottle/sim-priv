# REST API Design Principles

Best practices for designing Sim workflow APIs.

## Request/Response Mapping

### Input Schema Design

Design inputs for clarity and validation:

```javascript
inputFormat: {
  "action": {
    "type": "string",
    "description": "Action to perform"
  },
  "payload": {
    "type": "object",
    "description": "Request payload",
    "properties": {}
  },
  "options": {
    "type": "object",
    "description": "Optional settings",
    "properties": {}
  }
}
```

### Response Structure

Consistent response format using Response blocks:

```json
{
  "success": true,
  "data": {
    "result": "...",
    "metadata": {}
  },
  "error": null
}
```

## Error Handling

### Condition-Based Error Paths

```javascript
// Add condition after agent
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "condition",
    name: "Check Success",
    position: { x: 400, y: 100 },
    data: {
      condition: "{{blocks.agent.output.success}} === true"
    }
  }],
  edges: [
    { source: "agent_id", target: "condition_id" }
  ]
})

// Add success and error response blocks
add_blocks({
  workflowId: "wf_123",
  blocks: [
    {
      id: "success_response",
      type: "response",
      name: "Success Response",
      position: { x: 600, y: 50 },
      data: { body: '{"success": true, "data": {{blocks.agent.output}}}' }
    },
    {
      id: "error_response",
      type: "response",
      name: "Error Response",
      position: { x: 600, y: 150 },
      data: { body: '{"success": false, "error": {{blocks.agent.output.error}}}' }
    }
  ],
  edges: [
    { source: "condition_id", target: "success_response", sourceHandle: "true" },
    { source: "condition_id", target: "error_response", sourceHandle: "false" }
  ]
})
```

### Error Codes

Common error scenarios:

| Code | Scenario | Response |
|------|----------|----------|
| 401 | Invalid API key | `{"error": "Unauthorized"}` |
| 400 | Invalid input | `{"error": "Validation failed", "details": [...]}` |
| 429 | Rate limited | `{"error": "Too many requests"}` |
| 500 | Execution failed | `{"error": "Internal error", "executionId": "..."}` |

## Input Validation

### Agent-Based Validation

Use agent prompts for complex validation:

```
You are an input validator. Validate the following input:
- action must be one of: create, update, delete
- payload.email must be a valid email format
- payload.amount must be positive

If invalid, return: {"valid": false, "errors": [...]}
If valid, return: {"valid": true, "data": {...}}
```

### Code Block Validation

For programmatic validation:

```javascript
// Code block for validation
const { action, payload } = input;

if (!['create', 'update', 'delete'].includes(action)) {
  return { valid: false, error: 'Invalid action' };
}

if (!payload.email?.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
  return { valid: false, error: 'Invalid email' };
}

return { valid: true, data: { action, payload } };
```

## Rate Limiting Patterns

### Client-Side Rate Limiting

Document rate limits in API responses:

```javascript
// Response headers pattern
{
  "data": {...},
  "_rateLimit": {
    "limit": 100,
    "remaining": 95,
    "resetAt": "2024-01-01T12:00:00Z"
  }
}
```

### Workflow-Level Throttling

Use variables to track request counts:

```javascript
add_variable({
  workflowId: "wf_123",
  name: "requestCount",
  type: "number",
  value: 0
})
```

## Idempotency

### Request Deduplication

Accept idempotency keys in input:

```javascript
inputFormat: {
  idempotencyKey: { type: "string", description: "Unique request identifier" },
  action: { type: "string" },
  data: { type: "object" }
}
```

### Processing Pattern

Agent prompt for idempotency:

```
Before processing, check if this idempotencyKey has been seen:
- If yes, return the cached result
- If no, process the request and cache the result

Idempotency Key: {{blocks.start.output.idempotencyKey}}
```

## API Versioning

### URL-Based Versioning

Create separate workflows for each version:

- `workflow-v1` → `/api/workflows/{v1_id}/execute`
- `workflow-v2` → `/api/workflows/{v2_id}/execute`

### Header-Based Versioning

Use input to specify version:

```javascript
inputFormat: {
  apiVersion: { type: "string", description: "API version (v1, v2)" },
  request: { type: "object" }
}
```

Route with condition block:

```javascript
{
  type: "condition",
  data: {
    condition: "{{blocks.start.output.apiVersion}} === 'v2'"
  }
}
```

## Pagination

### Request Pattern

```javascript
inputFormat: {
  page: { type: "number", description: "Page number (1-based)" },
  limit: { type: "number", description: "Items per page (max 100)" },
  cursor: { type: "string", description: "Cursor for next page" }
}
```

### Response Pattern

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "hasNext": true,
    "nextCursor": "abc123"
  }
}
```

## Security Best Practices

1. **Never expose secrets** - Use workflow variables for sensitive data
2. **Validate all inputs** - Sanitize before processing
3. **Log request metadata** - Track for auditing (not sensitive data)
4. **Use HTTPS only** - Sim enforces this by default
5. **Rotate API keys** - Regular key rotation for production
