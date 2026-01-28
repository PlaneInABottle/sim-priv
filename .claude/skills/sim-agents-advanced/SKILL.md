---
name: sim-agents-advanced
description: Use when configuring advanced agent settings including model selection, system prompts, tool binding, context management, and token optimization in Sim workflows.
---

# Sim Agents Advanced Configuration

Guide for advanced agent configuration, model selection, prompt engineering, and tool binding patterns.

## Agent Block Configuration

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "agent",
    name: "Advanced Agent",
    position: { x: 300, y: 100 },
    data: {
      model: "gpt-4o",
      systemPrompt: "You are a specialized assistant.",
      temperature: 0.7,
      maxTokens: 2048,
      tools: ["search_web", "query_database"],
      knowledgeBases: ["kb_123"]
    }
  }]
})
```

## Model Selection Guide

| Model | Best For | Cost | Speed | Context |
|-------|----------|------|-------|---------|
| **gpt-4o** | Complex reasoning, code | $$$$ | Medium | 128K |
| **gpt-4o-mini** | Balanced tasks | $$ | Fast | 128K |
| **gpt-5** | Advanced reasoning | $$$ | Medium | 400K |
| **gpt-5-mini** | Fast reasoning tasks | $$ | Fast | 400K |
| **o3** | Multi-step reasoning | $$$ | Medium | 128K |
| **o4-mini** | Efficient reasoning | $$ | Fast | 128K |
| **claude-sonnet-4-5** | Nuanced writing, analysis | $$$ | Medium | 200K |
| **claude-haiku-4-5** | Fast responses | $ | Very Fast | 200K |
| **gemini-2.5-pro** | Long context, multimodal | $$$ | Medium | 1M |
| **gemini-2.5-flash** | Speed-critical tasks | $ | Very Fast | 1M |
| **Local (Ollama)** | Privacy, no API costs | Free | Varies | Varies |

### Selection Criteria

1. **Task Complexity**: Complex reasoning → GPT-4o, GPT-5, Claude Sonnet
2. **Speed Requirements**: Low latency → Haiku, Flash, GPT-4o-mini, o4-mini
3. **Context Length**: Long documents → Gemini (1M), GPT-5 (400K), Claude (200K)
4. **Budget**: Cost-sensitive → Mini/Haiku/Flash or local models
5. **Privacy**: Sensitive data → Local models via Ollama

## System Prompt Basics

### Structure Template

```
[ROLE] Define who the agent is
[CONTEXT] Provide relevant background
[TASK] Specify the objective
[CONSTRAINTS] Set boundaries and rules
[FORMAT] Define expected output format
```

### Example: Customer Support Agent

```
You are a customer support specialist for TechCorp.

CONTEXT:
- Products: Cloud services, developer tools
- Tone: Professional, friendly, helpful

TASK:
- Answer customer questions accurately
- Escalate billing issues to human support
- Never make promises about unreleased features

OUTPUT:
- Keep responses under 200 words
- Use bullet points for lists
- End with "Is there anything else I can help with?"
```

## Tool Binding Patterns

### Basic Tool Binding

```javascript
{
  tools: ["search_web", "send_email"],
  systemPrompt: `Use search_web to find current information.
Use send_email only when explicitly requested.`
}
```

### Constrained Tool Use

```javascript
{
  tools: ["database_query"],
  systemPrompt: `TOOL CONSTRAINTS:
- Only use SELECT queries, never UPDATE/DELETE
- Limit results to 100 rows maximum
- Always filter by date range when querying logs`
}
```

### Tool Selection Logic

```javascript
{
  tools: ["slack_message", "email_send", "sms_send"],
  systemPrompt: `Choose communication channel based on urgency:
- Urgent (< 1 hour): SMS
- Same day: Slack
- Standard: Email`
}
```

## Context Management

### Token Optimization

1. **Truncate early context**: Keep recent messages, summarize old ones
2. **Selective inclusion**: Only include relevant data
3. **Compression**: Use summarization for long documents

### Context Reference Pattern

```
{{blocks.previousAgent.output.summary}}
{{input.userQuery}}
{{variables.contextData}}
```

### Managing Long Conversations

```javascript
{
  systemPrompt: `You have access to conversation history.
Focus on the user's current request.
Reference previous context only when relevant.`
}
```

## Cost Optimization

| Strategy | Savings | Trade-off |
|----------|---------|-----------|
| Use mini/haiku models | 80-90% | Reduced capability |
| Reduce max tokens | 20-40% | Shorter responses |
| Cache frequent queries | 50-70% | Stale data risk |
| Batch operations | 30-50% | Higher latency |

### Model Tiering Pattern

```javascript
// Router → Model selection
{
  type: "router",
  data: {
    routes: [
      { condition: "{{input.complexity}} === 'high'", target: "gpt4_agent" },
      { condition: "{{input.complexity}} === 'low'", target: "mini_agent" }
    ]
  }
}
```

## Best Practices

1. **Start with cheaper models**, upgrade only if quality insufficient
2. **Be explicit in prompts** - vague instructions waste tokens
3. **Constrain tool access** - only enable necessary tools
4. **Use temperature wisely** - 0 for factual, 0.7-1.0 for creative
5. **Set max tokens** - prevent runaway costs
6. **Test prompt variations** - small changes can have big impacts

## See Also

- `references/model-selection.md` - Detailed model comparison
- `references/prompt-engineering.md` - Advanced prompt techniques
- `references/tool-binding.md` - Tool constraint patterns
- `examples/agent-templates.json` - Ready-to-use agent configs
