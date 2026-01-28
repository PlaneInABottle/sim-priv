# Usage Analytics Reference

## Metrics to Track

### Primary Metrics

| Metric | Source | Description |
|--------|--------|-------------|
| `currentPeriodCost` | userStats | Running total for billing period |
| `inputTokens` | execution logs | Tokens sent to LLM |
| `outputTokens` | execution logs | Tokens received from LLM |
| `cost` | execution logs | Per-execution cost |
| `executionCount` | workflow logs | Number of runs |

### Derived Metrics

| Metric | Formula | Purpose |
|--------|---------|---------|
| Avg cost/execution | totalCost / executions | Baseline for optimization |
| Token efficiency | outputTokens / inputTokens | Prompt effectiveness |
| Model mix | costs by model / total | Spending distribution |
| Daily burn rate | periodCost / daysElapsed | Budget pacing |
| Monthly projection | burnRate × 30 | Forecast |

## Billing API Reference

### GET /api/usage

Returns current usage data for authenticated user.

```json
{
  "currentPeriodCost": 45.23,
  "currentUsageLimit": 100,
  "creditBalance": 0,
  "percentUsed": 45.23,
  "isWarning": false,
  "isExceeded": false
}
```

### GET /api/billing

Returns subscription and billing status.

```json
{
  "subscription": {
    "plan": "pro",
    "status": "active",
    "baseLimit": 20
  },
  "billing": {
    "billingEnabled": true,
    "unbilledOverage": 0,
    "billedOverageThisPeriod": 0
  }
}
```

### GET /api/workflows/[id]/logs

Returns execution logs with cost breakdown.

```json
{
  "logs": [
    {
      "id": "log_123",
      "workflowId": "wf_456",
      "cost": 0.0045,
      "inputTokens": 1500,
      "outputTokens": 800,
      "model": "gpt-4o-mini",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Usage Patterns Analysis

### Healthy Patterns

- **Consistent daily usage**: Predictable costs, easy to budget
- **High token efficiency**: Output tokens < input tokens for most tasks
- **Model diversity**: Using appropriate model per task type
- **Low error rate**: Minimal wasted tokens on failed executions

### Warning Patterns

- **Cost spikes**: Sudden increases indicate issues
- **High output/input ratio**: Verbose prompts or model behavior
- **Single model dependency**: Missing optimization opportunities
- **Weekend spikes**: Automated workflows running unchecked

### Anti-Patterns

- **Retry loops**: Failed executions burning tokens
- **No caching**: Repeated identical queries
- **Over-engineered prompts**: Excessive context in every call
- **Wrong model selection**: GPT-4 for classification tasks

## Anomaly Detection

### Cost Anomalies

| Type | Detection | Action |
|------|-----------|--------|
| Spike | Cost > 3x daily average | Review recent workflows |
| Gradual increase | Week-over-week > 20% | Check new workflows |
| Unexpected zero | No cost when expected | Check execution status |

### Usage Anomalies

| Type | Detection | Action |
|------|-----------|--------|
| Token explosion | Tokens > 10x normal | Check infinite loops |
| Model drift | Expensive model % increasing | Review model selection |
| Error spike | Failed executions > 10% | Debug workflow issues |

### Alerting Thresholds

```javascript
// Cost thresholds
const DAILY_SPIKE_MULTIPLIER = 3;
const WEEKLY_INCREASE_THRESHOLD = 0.20;
const WARNING_PERCENT = 80;
const BLOCKED_PERCENT = 100;
const OVERAGE_INVOICE_THRESHOLD = 50;

// Token thresholds  
const MAX_TOKENS_PER_EXECUTION = 100000;
const ERROR_RATE_THRESHOLD = 0.10;
```

## Monitoring Implementation

### Database Queries

```sql
-- Daily cost by model
SELECT 
  DATE(created_at) as date,
  model,
  SUM(cost) as total_cost,
  COUNT(*) as executions
FROM workflow_execution_logs
WHERE user_id = ?
GROUP BY DATE(created_at), model
ORDER BY date DESC;

-- Top expensive workflows
SELECT 
  workflow_id,
  SUM(cost) as total_cost,
  COUNT(*) as runs
FROM workflow_execution_logs
WHERE user_id = ?
  AND created_at > NOW() - INTERVAL 30 DAY
GROUP BY workflow_id
ORDER BY total_cost DESC
LIMIT 10;

-- Token efficiency by workflow
SELECT 
  workflow_id,
  AVG(output_tokens::float / NULLIF(input_tokens, 0)) as efficiency
FROM workflow_execution_logs
WHERE user_id = ?
GROUP BY workflow_id;
```

### Real-Time Monitoring

```javascript
// Check usage status before execution
const status = await checkUsageStatus(userId);
if (status.isExceeded) {
  throw new Error('Usage limit exceeded');
}
if (status.isWarning) {
  console.warn(`Usage at ${status.percentUsed}%`);
}
```

## Dashboard Metrics

### Executive View
- Total spend (period)
- Budget remaining
- Monthly projection
- Top workflows by cost

### Operational View
- Executions today
- Average cost per execution
- Error rate
- Model distribution

### Optimization View
- Potential savings (model alternatives)
- Caching opportunities
- High-cost workflows
- Token efficiency scores
