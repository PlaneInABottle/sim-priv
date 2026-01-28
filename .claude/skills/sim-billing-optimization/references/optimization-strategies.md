# Optimization Strategies Reference

## Model Selection for Cost

### Decision Matrix

```
Task Complexity → Model Selection

Simple (classification, extraction, formatting):
  → GPT-4o-mini, Claude Haiku, Gemini Flash
  → Cost: $0.15-0.25 per 1M input tokens

Moderate (summarization, Q&A, basic reasoning):
  → GPT-4o, Claude Sonnet, Gemini Pro
  → Cost: $1-3 per 1M input tokens

Complex (multi-step reasoning, code generation, analysis):
  → GPT-4o, Claude 3.5 Sonnet, o1-mini
  → Cost: $2.50-15 per 1M input tokens

Critical (high-stakes decisions, legal, medical):
  → Claude Opus, o1, GPT-4-turbo
  → Cost: $10-30 per 1M input tokens
```

### Model Selection Workflow

```javascript
// Router block configuration
{
  "type": "router",
  "routes": [
    {
      "condition": "{{input.taskType}} === 'simple'",
      "model": "gpt-4o-mini"
    },
    {
      "condition": "{{input.taskType}} === 'complex'",
      "model": "gpt-4o"
    },
    {
      "condition": "{{input.requiresReasoning}} === true",
      "model": "o1-mini"
    }
  ],
  "default": "gpt-4o-mini"
}
```

## Batching Strategies

### Request Batching

Combine multiple items into single LLM call:

```javascript
// Instead of 10 separate calls
items.forEach(item => processItem(item));

// Batch into one call
const prompt = `Process these items:\n${items.join('\n')}`;
const results = await agent.run(prompt);
```

**Savings**: 10x reduction in per-call overhead, shared context tokens.

### Batch Size Guidelines

| Token Budget | Recommended Batch |
|-------------|-------------------|
| < 4K context | 5-10 items |
| 4K-16K context | 10-50 items |
| 16K-128K context | 50-200 items |
| 128K+ context | 200-500 items |

### Async Batch Processing

```javascript
// Use parallel block with batching
{
  "type": "parallel",
  "batchSize": 10,
  "items": "{{input.items}}",
  "maxConcurrency": 5
}
```

## Caching Strategies

### Response Caching

Cache deterministic LLM responses:

```javascript
const cacheKey = hash(model + prompt);
const cached = await redis.get(cacheKey);
if (cached) return cached;

const response = await llm.complete(prompt);
await redis.set(cacheKey, response, 'EX', 3600);
return response;
```

### Cache TTL Guidelines

| Content Type | TTL | Rationale |
|-------------|-----|-----------|
| Static facts | 24h+ | Rarely changes |
| Classifications | 1-4h | May need refresh |
| Summaries | 15-60min | Source may update |
| Real-time data | No cache | Always fresh |

### Semantic Caching

For similar (not identical) queries:

```javascript
// Generate embedding for query
const embedding = await embed(query);

// Find similar cached responses
const similar = await vectorDb.search(embedding, { threshold: 0.95 });
if (similar.length > 0) {
  return similar[0].response;
}
```

### Cache Hit Optimization

- Normalize prompts before hashing
- Strip timestamps/dynamic values
- Use consistent formatting
- Version cache keys with model name

## Prompt Optimization

### Token Reduction Techniques

1. **Remove redundancy**
```diff
- You are a helpful AI assistant. Your job is to help users.
+ You are a helpful assistant.
```

2. **Use abbreviations in system prompts**
```diff
- When the user asks a question, you should provide a detailed answer.
+ Answer questions thoroughly.
```

3. **Structured output**
```diff
- Please provide your answer in a well-formatted way
+ Respond in JSON: {"answer": string, "confidence": number}
```

4. **Limit examples**
```diff
- Here are 5 examples of how to respond...
+ Example: Input: "hello" → Output: {"greeting": true}
```

### Output Token Control

```javascript
// Agent block configuration
{
  "type": "agent",
  "data": {
    "model": "gpt-4o-mini",
    "maxTokens": 500,  // Hard limit
    "systemPrompt": "Be concise. Max 3 sentences."
  }
}
```

### Prompt Templates

```javascript
// Efficient classification prompt
const CLASSIFY_PROMPT = `Classify: {{input.text}}
Categories: {{categories}}
Output: {"category": string}`;

// Efficient extraction prompt  
const EXTRACT_PROMPT = `Extract from: {{input.text}}
Fields: {{fields}}
Output: JSON with extracted values only`;
```

## Monitoring and Alerting

### Cost Alerts Configuration

```javascript
const alertConfig = {
  dailyBudget: 50,
  warningThreshold: 0.80,  // 80% of daily budget
  criticalThreshold: 1.00, // 100% of daily budget
  spikeMultiplier: 3,      // 3x normal triggers spike alert
  
  channels: {
    warning: ['slack', 'email'],
    critical: ['slack', 'email', 'pagerduty']
  }
};
```

### Alert Types

| Alert | Trigger | Action |
|-------|---------|--------|
| Budget Warning | 80% of limit | Notify team |
| Budget Critical | 100% of limit | Block new executions |
| Cost Spike | 3x daily average | Investigate immediately |
| Model Drift | Expensive model > 50% | Review selection logic |
| Error Spike | > 10% failures | Debug workflows |

### Monitoring Workflow

```javascript
// Scheduled monitoring block
{
  "type": "code",
  "schedule": "0 * * * *",  // Hourly
  "code": `
    const usage = await getUsageData();
    const projection = usage.dailyCost * 30;
    
    if (projection > budget * 1.2) {
      await sendAlert('cost_projection', { projection, budget });
    }
  `
}
```

### Dashboard Queries

```sql
-- Hourly cost trend
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  SUM(cost) as cost
FROM workflow_execution_logs
WHERE created_at > NOW() - INTERVAL 24 HOUR
GROUP BY hour
ORDER BY hour;

-- Model cost distribution
SELECT 
  model,
  SUM(cost) as total,
  COUNT(*) as calls,
  AVG(cost) as avg_cost
FROM workflow_execution_logs
WHERE created_at > NOW() - INTERVAL 7 DAY
GROUP BY model
ORDER BY total DESC;
```

## Quick Implementation Checklist

- [ ] Set usage limits in userStats
- [ ] Configure 80% warning alerts
- [ ] Implement response caching
- [ ] Review model selection per workflow
- [ ] Add max_tokens to agent blocks
- [ ] Set up daily cost monitoring
- [ ] Create cost spike detection
- [ ] Document optimization decisions
