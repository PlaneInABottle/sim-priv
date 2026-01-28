---
name: sim-billing-optimization
description: Use when optimizing LLM costs, analyzing token usage, comparing model pricing, implementing caching strategies, setting up cost monitoring and alerts, or reducing execution costs in Sim workflows.
---

# Sim Billing Optimization

Cost management and optimization guidance for Sim Studio workflows.

## Token Pricing Overview

### OpenAI Models (per 1M tokens)

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| GPT-4o | $2.50 | $10.00 | Best price/performance |
| GPT-4o-mini | $0.15 | $0.60 | Cost-effective for simple tasks |
| GPT-5 | $1.25 | $10.00 | Advanced reasoning, 400K context |
| GPT-5-mini | $0.25 | $2.00 | Fast reasoning |
| o1 | $15.00 | $60.00 | Reasoning model |
| o3 | $2.00 | $8.00 | Multi-step reasoning |
| o4-mini | $1.10 | $4.40 | Efficient reasoning |

### Anthropic Models (per 1M tokens)

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| claude-sonnet-4-5 | $3.00 | $15.00 | Best for complex tasks |
| claude-opus-4-5 | $15.00 | $75.00 | Premium, use sparingly |
| claude-haiku-4-5 | $1.00 | $5.00 | Fast and efficient |

### Google Models (per 1M tokens)

| Model | Input | Output | Notes |
|-------|-------|--------|-------|
| Gemini 2.5 Pro | $1.25 | $5.00 | Good balance |
| Gemini 2.5 Flash | $0.075 | $0.30 | Very cost-effective |
| Gemini 2.0 Flash | $0.10 | $0.40 | Latest flash model |

## Cost Calculation

```
Cost = (inputTokens × inputPrice/1M) + (outputTokens × outputPrice/1M)
```

**Example:** 1000 input + 500 output tokens with GPT-4o-mini:
- Input: 1000 × $0.15/1M = $0.00015
- Output: 500 × $0.60/1M = $0.0003
- Total: $0.00045

## Optimization Strategies

### 1. Model Selection
- Use cheapest model that meets quality requirements
- GPT-4o-mini or Claude Haiku for simple tasks
- Reserve GPT-4o/Claude Sonnet for complex reasoning

### 2. Prompt Optimization
- Shorter prompts = fewer input tokens
- Be concise in system prompts
- Remove redundant instructions
- Use structured output to control response length

### 3. Caching
- Cache repeated queries with same inputs
- Use response caching for deterministic outputs
- Implement semantic caching for similar queries

### 4. Batching
- Combine multiple small requests into one
- Process arrays in single agent calls
- Use loops efficiently with batch sizes

### 5. Conditional Execution
- Use router blocks to skip expensive operations
- Implement early termination logic
- Gate expensive models behind quality checks

## Usage Monitoring

### Key Metrics
- `currentPeriodCost`: Running total this billing period
- `inputTokens` / `outputTokens`: Per-execution token counts
- `cost`: Per-execution cost in `workflow_execution_logs`

### Cost Tracking APIs
- `GET /api/usage`: Current period usage and limits
- `GET /api/billing`: Subscription and billing status
- Workflow logs include per-block cost breakdown

### Alerting Thresholds
- **80%**: Warning threshold (approaching limit)
- **100%**: Block threshold (execution blocked)
- **$50 overage**: Auto-invoice trigger

## Quick Wins

1. **Switch to mini models**: Replace GPT-4o with GPT-4o-mini for ~17x savings
2. **Limit output tokens**: Set `max_tokens` to prevent verbose responses
3. **Cache API responses**: Add Redis caching for repeated queries
4. **Monitor daily**: Review usage dashboard for spikes
5. **Set alerts**: Configure 80% warning notifications

## Reference Documents

- `references/cost-analysis.md` - Detailed pricing and calculations
- `references/usage-analytics.md` - Metrics and monitoring APIs
- `references/optimization-strategies.md` - Implementation patterns
- `examples/cost-optimization-templates.json` - Ready-to-use workflow patterns
