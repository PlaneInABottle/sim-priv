# Tool Binding Guide

Advanced patterns for binding tools to agents with constraints, validation, and error handling.

## Tool Constraints

### Limiting Tool Access

```javascript
// Grant only necessary tools
{
  tools: ["search_web"],  // Read-only
  systemPrompt: "You can search the web for information. You cannot modify any data."
}

// vs. full access (risky)
{
  tools: ["database_query", "database_insert", "database_delete"],  // Read/write
  systemPrompt: "You have full database access."
}
```

### Operation Restrictions

```javascript
{
  tools: ["database_query"],
  systemPrompt: `DATABASE CONSTRAINTS:
  - Only use SELECT statements
  - Never execute UPDATE, DELETE, or DROP
  - Limit all queries to 100 rows: LIMIT 100
  - Always include WHERE clause for large tables
  - Timeout: Abort queries taking > 5 seconds`
}
```

### Scope Limitations

```javascript
{
  tools: ["slack_message"],
  systemPrompt: `SLACK CONSTRAINTS:
  - Only post to #general and #support channels
  - Never post to #executive or #private-*
  - Do not @mention @channel or @here
  - Maximum message length: 500 characters`
}
```

## Parameter Validation

### In-Prompt Validation

```javascript
{
  tools: ["send_email"],
  systemPrompt: `Before using send_email, validate:
  1. Email format: must contain @ and valid domain
  2. Subject: required, max 100 chars
  3. Body: required, max 5000 chars
  4. Recipients: max 10 per email
  
  If validation fails, ask user to correct the input.`
}
```

### Type Checking

```javascript
{
  tools: ["api_call"],
  systemPrompt: `API PARAMETER TYPES:
  - endpoint: string, must start with /api/
  - method: enum ["GET", "POST", "PUT"]
  - body: valid JSON object (POST/PUT only)
  - headers: key-value pairs
  
  Reject requests with invalid types.`
}
```

### Range Validation

```javascript
{
  tools: ["create_order"],
  systemPrompt: `ORDER CONSTRAINTS:
  - quantity: 1-100 (integer)
  - price: 0.01-10000.00 (2 decimal places)
  - discount: 0-50 (percentage)
  - shipping_days: 1-30
  
  Reject orders outside these ranges.`
}
```

## Output Parsing

### Structured Output Requirement

```javascript
{
  model: "gpt-4o",
  systemPrompt: `Always respond in valid JSON:
  {
    "action": "tool_name",
    "parameters": { ... },
    "reasoning": "why this action"
  }
  
  Never include text outside the JSON structure.`
}
```

### Tool Result Processing

```javascript
{
  systemPrompt: `After using a tool, process the result:
  
  1. Check for errors:
     - If error, explain to user and suggest alternatives
  
  2. Validate data:
     - Ensure expected fields are present
     - Check for null/empty values
  
  3. Format response:
     - Extract relevant information
     - Present in user-friendly format`
}
```

### Multi-Tool Orchestration

```javascript
{
  tools: ["search_products", "check_inventory", "create_order"],
  systemPrompt: `TOOL SEQUENCE:
  1. search_products → Get product ID
  2. check_inventory → Verify availability  
  3. create_order → Only if in stock
  
  Parse each result before proceeding.
  If any step fails, stop and report the issue.`
}
```

## Error Handling

### Graceful Degradation

```javascript
{
  tools: ["primary_api", "fallback_api"],
  systemPrompt: `ERROR HANDLING:
  
  If primary_api fails:
  - Retry once after 2 seconds
  - If still fails, try fallback_api
  - If both fail, inform user and log error
  
  Never expose raw error messages to users.
  Instead: "I'm having trouble accessing that service. Please try again later."`
}
```

### Error Classification

```javascript
{
  systemPrompt: `CLASSIFY ERRORS:
  
  RETRY (temporary):
  - 429: Rate limited → wait and retry
  - 503: Service unavailable → retry after 5s
  - Timeout → retry once
  
  ESCALATE (needs human):
  - 401/403: Auth issues
  - 500: Server errors
  
  USER_FIX (wrong input):
  - 400: Bad request → ask user to correct
  - 404: Not found → verify input`
}
```

### Error Response Format

```javascript
{
  systemPrompt: `When errors occur, respond:
  
  {
    "success": false,
    "error_type": "RETRY|ESCALATE|USER_FIX",
    "user_message": "Friendly explanation",
    "suggested_action": "What user can do",
    "technical_details": "For logging only"
  }`
}
```

## Tool Use Patterns

### Conditional Tool Use

```javascript
{
  tools: ["search_internal", "search_web"],
  systemPrompt: `TOOL SELECTION:
  - First, always try search_internal
  - If no results, then use search_web
  - Never use search_web for confidential queries`
}
```

### Sequential Tool Chains

```javascript
{
  tools: ["get_user", "get_orders", "calculate_stats"],
  systemPrompt: `CHAIN PATTERN:
  1. get_user(email) → returns user_id
  2. get_orders(user_id) → returns order_list
  3. calculate_stats(order_list) → returns analytics
  
  Each step depends on the previous.
  Stop if any step returns empty/error.`
}
```

### Parallel Tool Use

```javascript
{
  tools: ["check_stock_us", "check_stock_eu", "check_stock_asia"],
  systemPrompt: `For inventory queries:
  - Query all regions simultaneously
  - Aggregate results into unified response
  - Report regions with availability`
}
```

### Tool Selection Logic

```javascript
{
  tools: ["sms", "email", "slack", "webhook"],
  systemPrompt: `NOTIFICATION RULES:
  
  | Priority | Channel | Conditions |
  |----------|---------|------------|
  | Critical | SMS     | Downtime, security |
  | High     | Slack   | Errors, alerts |
  | Medium   | Email   | Reports, summaries |
  | Low      | Webhook | Logging only |
  
  Select channel based on message priority.`
}
```

## Security Patterns

### Sensitive Data Handling

```javascript
{
  tools: ["customer_lookup"],
  systemPrompt: `DATA SECURITY:
  - Never log full credit card numbers
  - Mask SSN: show only last 4 digits
  - Do not include passwords in responses
  - Redact PII before sending to external tools`
}
```

### Rate Limiting

```javascript
{
  tools: ["expensive_api"],
  systemPrompt: `RATE LIMITS:
  - Max 10 calls per minute to expensive_api
  - Track call count in conversation
  - If limit reached, queue requests
  - Warn user when approaching limit`
}
```

### Audit Trail

```javascript
{
  tools: ["modify_record"],
  systemPrompt: `AUDIT REQUIREMENTS:
  Every modify_record call must:
  1. Log user who requested change
  2. Record before/after values
  3. Include timestamp
  4. Note reason for modification`
}
```

## Best Practices

| Practice | Rationale |
|----------|-----------|
| Minimum tool grants | Reduce attack surface |
| Explicit constraints | Prevent unintended actions |
| Validate before execute | Catch errors early |
| Parse tool outputs | Ensure data quality |
| Handle all error cases | Graceful failures |
| Log tool usage | Debugging, audit |
| Rate limit expensive tools | Cost control |
