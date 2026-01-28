# Cost Analysis Reference

## Token Pricing by Model

### OpenAI Models

| Model | Input ($/1M) | Output ($/1M) | Context | Best For |
|-------|-------------|---------------|---------|----------|
| gpt-4o | 2.50 | 10.00 | 128K | General purpose |
| gpt-4o-mini | 0.15 | 0.60 | 128K | Simple tasks, high volume |
| gpt-5 | 1.25 | 10.00 | 400K | Advanced reasoning |
| gpt-5-mini | 0.25 | 2.00 | 400K | Fast reasoning |
| gpt-4.1 | 2.00 | 8.00 | 128K | Efficient general use |
| o1 | 15.00 | 60.00 | 200K | Multi-step reasoning |
| o3 | 2.00 | 8.00 | 128K | Multi-step reasoning |
| o4-mini | 1.10 | 4.40 | 128K | Efficient reasoning |

### Anthropic Models

| Model | Input ($/1M) | Output ($/1M) | Context | Best For |
|-------|-------------|---------------|---------|----------|
| claude-sonnet-4-5 | 3.00 | 15.00 | 200K | Complex analysis |
| claude-opus-4-5 | 15.00 | 75.00 | 200K | Premium tasks |
| claude-haiku-4-5 | 1.00 | 5.00 | 200K | Fast, efficient |

### Google Models

| Model | Input ($/1M) | Output ($/1M) | Context | Best For |
|-------|-------------|---------------|---------|----------|
| gemini-2.5-pro | 1.25 | 5.00 | 1M | Long context |
| gemini-2.5-flash | 0.075 | 0.30 | 1M | High volume |
| gemini-2.0-flash | 0.10 | 0.40 | 1M | Latest fast model |

### Open Source (via providers)

| Model | Input ($/1M) | Output ($/1M) | Provider |
|-------|-------------|---------------|----------|
| llama-3.1-70b | 0.90 | 0.90 | Groq/Together |
| llama-3.1-8b | 0.20 | 0.20 | Groq/Together |
| mixtral-8x7b | 0.50 | 0.50 | Groq/Together |
| mistral-large | 3.00 | 9.00 | Mistral |

## Cost Calculation Formulas

### Basic Cost
```javascript
cost = (inputTokens * inputPrice / 1_000_000) + 
       (outputTokens * outputPrice / 1_000_000)
```

### Workflow Total Cost
```javascript
workflowCost = blocks.reduce((sum, block) => sum + block.cost, 0)
```

### Monthly Projection
```javascript
monthlyProjection = (currentPeriodCost / daysElapsed) * 30
```

### Cost Per Request
```javascript
avgCostPerRequest = totalCost / requestCount
```

## Execution Cost Breakdown

### Components
1. **LLM Calls**: Primary cost driver (token-based)
2. **Tool Calls**: May include external API costs
3. **Knowledge Base**: Embedding generation and retrieval
4. **Storage**: Log retention (minimal)

### Typical Cost Distribution
- Agent blocks: 80-95% of workflow cost
- API/tool blocks: 5-15% (external service dependent)
- Condition/router: ~0% (no LLM cost)
- Code blocks: ~0% (execution only)

## Cost Optimization Techniques

### Model Downgrade Matrix

| Current Model | Alternative | Savings | Trade-off |
|--------------|-------------|---------|-----------|
| GPT-4o | GPT-4o-mini | 94% | Reduced reasoning |
| Claude Opus | Claude Sonnet | 80% | Slightly less capable |
| Claude Sonnet | Claude Haiku | 67% | Speed vs depth |
| Gemini Pro | Gemini Flash | 94% | Less capable |

### Token Reduction Strategies

1. **Prompt compression**: Remove filler words, use abbreviations
2. **Example trimming**: Use 1-2 examples instead of 5+
3. **Output limiting**: Set `max_tokens` parameter
4. **Structured output**: JSON schema reduces verbosity

### Volume Discounts (when available)

- Anthropic: Batch API 50% discount
- OpenAI: Batch API 50% discount  
- Committed use: Negotiate with provider for 20-40% off

## Cost Comparison Examples

### Simple Classification Task (1000 requests/day)

| Model | Cost/Request | Daily | Monthly |
|-------|-------------|-------|---------|
| GPT-4 | $0.045 | $45 | $1,350 |
| GPT-4o | $0.006 | $6 | $180 |
| GPT-4o-mini | $0.0004 | $0.40 | $12 |
| Claude Haiku | $0.0008 | $0.80 | $24 |
| Gemini Flash | $0.0002 | $0.20 | $6 |

*Assumes 500 input + 200 output tokens per request*

### Complex Analysis Task (100 requests/day)

| Model | Cost/Request | Daily | Monthly |
|-------|-------------|-------|---------|
| GPT-4o | $0.07 | $7 | $210 |
| Claude Sonnet | $0.10 | $10 | $300 |
| Claude Opus | $0.50 | $50 | $1,500 |

*Assumes 2000 input + 5000 output tokens per request*
