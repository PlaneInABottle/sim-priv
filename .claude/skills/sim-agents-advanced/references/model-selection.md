# Model Selection Guide

Comprehensive guide for choosing the right model for your Sim agent workflows.

## Model Comparison

### OpenAI Models

| Model | Input Cost | Output Cost | Context | Strengths |
|-------|------------|-------------|---------|-----------|
| gpt-4o | $2.50/1M | $10/1M | 128K | Best overall, multimodal |
| gpt-4o-mini | $0.15/1M | $0.60/1M | 128K | Fast, cost-effective |
| gpt-5 | $1.25/1M | $10/1M | 400K | Advanced reasoning |
| gpt-5-mini | $0.25/1M | $2/1M | 400K | Fast reasoning |
| gpt-4-turbo | $10/1M | $30/1M | 128K | Legacy, stable |
| o1 | $15/1M | $60/1M | 200K | Advanced reasoning |
| o1-mini | $3/1M | $12/1M | 128K | Reasoning, cheaper |
| o3 | $2/1M | $8/1M | 128K | Multi-step reasoning |
| o4-mini | $1.10/1M | $4.40/1M | 128K | Efficient reasoning |

### Anthropic Models

| Model | Input Cost | Output Cost | Context | Strengths |
|-------|------------|-------------|---------|-----------|
| claude-sonnet-4-5 | $3/1M | $15/1M | 200K | Nuanced, long context |
| claude-haiku-4-5 | $1.00/1M | $5.00/1M | 200K | Very fast, cheap |
| claude-opus-4-5 | $15/1M | $75/1M | 200K | Maximum capability |

### Google Models

| Model | Input Cost | Output Cost | Context | Strengths |
|-------|------------|-------------|---------|-----------|
| gemini-2.5-pro | $1.25/1M | $5/1M | 1M | Massive context |
| gemini-2.5-flash | $0.075/1M | $0.30/1M | 1M | Fast, long context |
| gemini-2.0-flash | $0.10/1M | $0.40/1M | 1M | Latest, faster |

### Local Models (Ollama)

| Model | Size | RAM | Speed | Use Case |
|-------|------|-----|-------|----------|
| llama3.2 | 3B | 4GB | Fast | Simple tasks |
| llama3.1 | 8B | 8GB | Medium | General use |
| llama3.1 | 70B | 48GB | Slow | Complex tasks |
| mistral | 7B | 8GB | Fast | Coding, chat |
| codellama | 34B | 24GB | Medium | Code generation |

## Cost Analysis

### Per 1000 Requests (avg 500 input + 500 output tokens)

| Model | Cost per 1K | Monthly (10K/day) |
|-------|-------------|-------------------|
| gpt-4o | $6.25 | $1,875 |
| gpt-4o-mini | $0.38 | $114 |
| gpt-5 | $5.63 | $1,689 |
| gpt-5-mini | $1.13 | $339 |
| o3 | $5.00 | $1,500 |
| o4-mini | $2.75 | $825 |
| claude-sonnet-4-5 | $9.00 | $2,700 |
| claude-haiku-4-5 | $3.00 | $900 |
| gemini-2.5-flash | $0.19 | $57 |
| Local (Ollama) | $0 | ~$50 (compute) |

### Cost Reduction Strategies

1. **Model Cascading**: Route simple queries to cheaper models
2. **Caching**: Store frequent responses
3. **Prompt Compression**: Reduce input tokens
4. **Batch Processing**: Combine related requests

## Latency Analysis

### Time to First Token (TTFT)

| Model | p50 | p95 |
|-------|-----|-----|
| gpt-4o-mini | 200ms | 500ms |
| claude-haiku-4-5 | 150ms | 400ms |
| gemini-2.5-flash | 100ms | 300ms |
| gpt-4o | 400ms | 1200ms |
| claude-sonnet-4-5 | 350ms | 900ms |

### Tokens Per Second (TPS)

| Model | TPS |
|-------|-----|
| gemini-2.5-flash | 150+ |
| claude-haiku-4-5 | 100+ |
| gpt-4o-mini | 80+ |
| gpt-4o | 50+ |
| claude-sonnet-4-5 | 60+ |

## Task-Based Recommendations

### Customer Support
- **Primary**: gpt-4o-mini, claude-haiku-4-5
- **Escalation**: gpt-4o, claude-sonnet-4-5
- **Rationale**: Speed matters, most queries are simple

### Code Generation
- **Primary**: gpt-4o, gpt-5, claude-sonnet-4-5
- **Budget**: codellama (local), gpt-4o-mini, gpt-5-mini
- **Rationale**: Accuracy critical, complexity varies

### Document Analysis
- **Long docs**: gemini-2.5-pro (1M context), gpt-5 (400K context)
- **Standard**: claude-sonnet-4-5 (200K context)
- **Budget**: gemini-2.5-flash

### Creative Writing
- **Primary**: claude-sonnet-4-5 (nuanced)
- **Fast drafts**: gpt-4o-mini
- **Rationale**: Style and creativity matter

### Data Processing
- **Structured output**: gpt-4o (JSON mode reliable)
- **High volume**: gpt-4o-mini, gemini-flash
- **Rationale**: Consistency and cost balance

## Configuration Examples

### High-Quality Agent
```javascript
{
  model: "gpt-4o",
  temperature: 0.3,
  maxTokens: 4096
}
```

### Fast/Cheap Agent
```javascript
{
  model: "claude-haiku-4-5",
  temperature: 0.5,
  maxTokens: 1024
}
```

### Long Context Agent
```javascript
{
  model: "gemini-2.5-pro",
  temperature: 0.2,
  maxTokens: 8192
}
```

### Local/Private Agent
```javascript
{
  model: "ollama/llama3.1",
  temperature: 0.7,
  maxTokens: 2048
}
```

## Model Parameters

### Temperature

| Value | Use Case |
|-------|----------|
| 0.0 | Deterministic, factual (data extraction) |
| 0.3 | Consistent but slightly varied |
| 0.5 | Balanced creativity |
| 0.7 | Creative tasks |
| 1.0+ | Maximum creativity (brainstorming) |

### Max Tokens

- **Short responses**: 256-512
- **Standard**: 1024-2048
- **Long form**: 4096+
- **Tip**: Lower = faster + cheaper
