# Debugging Guide

Patterns and techniques for troubleshooting Sim workflows.

## Debugging Approach

### 1. Identify the Problem
- Check execution logs for error details
- Note which block failed
- Review input/output at failure point

### 2. Isolate the Issue
- Test the failing block independently
- Verify inputs are correct
- Check external service connectivity

### 3. Fix and Verify
- Make targeted changes
- Test with same input
- Monitor subsequent executions

## Common Error Types

### Expression Errors

**Symptom:** `Cannot read property 'x' of undefined`

**Cause:** Referencing nested property that doesn't exist

**Fix:**
```javascript
// Bad
{{blocks.agent.output.data.results[0].id}}

// Good - with null checks
{{blocks.agent.output?.data?.results?.[0]?.id}}

// Or use default
{{blocks.agent.output.data.results[0].id || 'default'}}
```

### Type Mismatches

**Symptom:** Condition always evaluates to false

**Cause:** String vs number comparison

**Fix:**
```javascript
// Bad - comparing string to number
{{input.count}} === 5

// Good - ensure same type
parseInt({{input.count}}) === 5
// or
{{input.count}} === '5'
```

### Missing Credentials

**Symptom:** `401 Unauthorized` from external service

**Cause:** OAuth token expired or API key invalid

**Fix:**
1. Go to Settings → Integrations
2. Reconnect the service
3. Verify API key is current

### Timeout Errors

**Symptom:** `Execution timeout exceeded`

**Cause:** Block took too long

**Fix:**
- Increase block timeout setting
- Optimize slow operations
- Add retries with backoff

### Rate Limiting

**Symptom:** `429 Too Many Requests`

**Cause:** Hitting API rate limits

**Fix:**
- Add delay between requests
- Batch operations
- Implement exponential backoff

## Debugging Tools

### Console Log Block
Insert a code block to log values:

```javascript
{
  type: "code",
  name: "Debug Logger",
  data: {
    code: `
      console.log('=== DEBUG ===');
      console.log('Input:', JSON.stringify(input, null, 2));
      return input;
    `
  }
}
```

### Variable Inspection
Store intermediate values in workflow variables:

```javascript
// In agent prompt or code block
// Store: {{set variables.debugState = currentValue}}
// Later: {{variables.debugState}}
```

### Execution Traces
Full traces are available with `details=full`:

```javascript
// Each block trace includes:
{
  blockId: "agent_1",
  blockName: "My Agent",
  blockType: "agent",
  startTime: "...",
  endTime: "...",
  durationMs: 850,
  status: "success" | "error",
  input: { ... },
  output: { ... },
  error: "..." // if failed
}
```

## Workflow-Specific Issues

### Condition Block

**Issue:** Always takes wrong branch

**Debug:**
1. Log the condition expression result
2. Check actual value types
3. Verify expression syntax

```javascript
// Debug condition
{
  type: "code",
  data: {
    code: `
      const value = input.status;
      console.log('Status value:', value, 'Type:', typeof value);
      console.log('Condition result:', value === 'success');
      return input;
    `
  }
}
```

### Loop Block

**Issue:** Infinite loop or wrong iterations

**Debug:**
1. Set `maxIterations` to a small number
2. Log each iteration
3. Verify exit condition

```javascript
// In loop body
console.log('Iteration:', {{loop.index}}, 'Item:', {{loop.item}});
```

### Parallel Block

**Issue:** Some branches don't complete

**Debug:**
1. Check each branch independently
2. Look for unhandled errors
3. Verify all branches have output

### Agent Block

**Issue:** Wrong or no response

**Debug:**
1. Check system prompt
2. Verify knowledge base connectivity
3. Test with simpler prompt
4. Check tool permissions

## External Service Issues

### API Connectivity
```javascript
// Test connectivity with code block
{
  type: "code",
  data: {
    code: `
      try {
        // Simple connectivity test
        const response = await fetch('https://api.example.com/health');
        return { status: response.status };
      } catch (e) {
        return { error: e.message };
      }
    `
  }
}
```

### OAuth Token Issues
1. Check token expiration
2. Force refresh by reconnecting
3. Verify scopes are sufficient

### Webhook Issues
1. Check webhook URL is correct
2. Verify payload format matches
3. Test with curl/Postman first

## Performance Debugging

### Slow Execution

**Identify:**
- Review block durations in trace
- Look for sequential bottlenecks

**Fix:**
- Parallelize independent blocks
- Use faster LLM models
- Cache repeated lookups

### High Token Usage

**Identify:**
- Check cost breakdown in logs
- Review prompt lengths

**Fix:**
- Shorten system prompts
- Limit context/history
- Use smaller models where appropriate

## Error Recovery Patterns

### Retry with Backoff
```javascript
{
  type: "loop",
  name: "Retry Loop",
  data: {
    maxIterations: 3,
    condition: "{{blocks.apiCall.output.success}} !== true"
  },
  children: [
    {
      type: "code",
      name: "Backoff Delay",
      data: {
        code: `
          const delay = Math.pow(2, {{loop.index}}) * 1000;
          await new Promise(r => setTimeout(r, delay));
          return input;
        `
      }
    },
    {
      type: "api",
      name: "API Call"
    }
  ]
}
```

### Fallback Response
```javascript
{
  type: "condition",
  name: "Check Success",
  data: { condition: "{{blocks.main.output.success}}" }
},
// True branch: continue
// False branch: fallback agent with simpler approach
```

### Error Notification
```javascript
// On error, notify via Slack
{
  type: "agent",
  name: "Error Notifier",
  data: {
    tools: ["slack_message"],
    systemPrompt: "Send error details to #alerts channel"
  }
}
```

## Production Debugging Tips

1. **Use log levels** - Filter by `error` for quick triage
2. **Add request IDs** - Track related logs
3. **Monitor error rates** - Set up alerts for spikes
4. **Keep logs** - Don't delete recent logs during debugging
5. **Test in isolation** - Use manual trigger with test input
