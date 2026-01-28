---
name: sim-execution-monitoring
description: Use when debugging workflows, analyzing execution logs, monitoring performance, handling errors, or troubleshooting workflow issues - includes execution API reference and debugging patterns.
---

# Sim Execution & Monitoring

Guide for workflow execution, debugging, and monitoring in Sim.

## Execution Lifecycle

### Execution States
- **running** - Workflow actively executing
- **completed** - Finished successfully
- **error** - Failed with error
- **paused** - Waiting for human input (HITL)
- **cancelled** - Manually cancelled

### Execution Flow
```
Trigger → Block Execution → [Condition/Loop] → Response → Complete
    ↓           ↓
  Error ←──── Error
```

## Triggering Executions

### Manual (UI)
Click "Run" in workflow editor. Supports SSE streaming for real-time updates.

### API Trigger
```bash
POST /api/workflows/{id}/execute
Authorization: Bearer {api_key}
Content-Type: application/json

{
  "input": { "message": "Hello" }
}
```

### Webhook Trigger
```bash
POST /api/webhooks/trigger/{webhook_path}
Content-Type: application/json

{
  "event": "user.created",
  "data": { ... }
}
```

### Scheduled
Cron-based scheduling via workflow settings.

## Execution Response

### Sync Response
```json
{
  "success": true,
  "output": {
    "blockId_response": { ... }
  },
  "metadata": {
    "duration": 1234,
    "startTime": "2024-01-15T10:30:00Z",
    "endTime": "2024-01-15T10:30:01Z"
  }
}
```

### SSE Streaming Events
```
event: execution:started
event: block:started
event: block:completed
event: stream:chunk (for LLM streaming)
event: execution:completed
```

## Logging & Traces

### Log Structure
Each execution produces logs with:
- **Execution ID** - Unique identifier
- **Block traces** - Per-block input/output/timing
- **Cost tracking** - Token usage and costs
- **Error details** - Stack traces on failure

### Accessing Logs

**API:**
```
GET /api/logs?workspaceId={id}&limit=100&details=full
```

**Filters:**
- `workflowIds` - Filter by workflow
- `level` - `info`, `error`, `running`, `pending`
- `trigger` - `api`, `webhook`, `schedule`, `manual`
- `dateFrom` / `dateTo` - Time range
- `search` - Text search in logs

### Log Entry Fields
```typescript
{
  id: string,
  executionId: string,
  workflowId: string,
  status: "running" | "completed" | "error" | "paused",
  trigger: "api" | "webhook" | "schedule" | "manual",
  startedAt: string,
  endedAt: string,
  totalDurationMs: number,
  cost: {
    total: number,
    tokens: { input, output, total }
  },
  executionData: {
    traceSpans: [...],
    finalOutput: any
  }
}
```

## Debugging Workflows

### Common Issues

**Block Timeout**
- Increase timeout in block settings
- Check external service responsiveness
- Add retry logic

**Missing Input**
- Verify trigger sends expected data
- Check expression syntax: `{{input.field}}`
- Log input at first block

**Condition Not Matching**
- Log condition expression evaluation
- Verify data types match
- Check for null/undefined values

**Loop Infinite**
- Set `maxIterations` limit
- Verify exit condition logic
- Add logging in loop body

### Debugging Patterns

**Log Block Inputs/Outputs**
```javascript
// Add a code block before suspect block
{
  type: "code",
  data: {
    code: `console.log("Input:", JSON.stringify(input)); return input;`
  }
}
```

**Capture Intermediate State**
Use variables to store state between blocks:
```javascript
// Set variable
{{ set variables.debugData = blocks.agent.output }}

// Read later
{{ variables.debugData }}
```

## Performance Analysis

### Metrics to Monitor
- **Total duration** - End-to-end time
- **Block duration** - Per-block timing
- **Token usage** - LLM costs
- **Error rate** - Failure percentage

### Identifying Bottlenecks
1. Check execution traces for slow blocks
2. Look for sequential dependencies that could parallelize
3. Monitor external API latency
4. Review LLM model selection (faster models for simple tasks)

### Optimization Tips
- Use parallel blocks for independent operations
- Cache frequent lookups in variables
- Choose appropriate LLM models
- Set reasonable timeouts
- Batch similar operations

## Error Handling

### Block-Level Error Handling
```typescript
{
  onError: {
    continueOnError: true,
    fallbackValue: { "default": "response" },
    errorHandler: "errorBlockId"
  }
}
```

### Workflow Error Patterns
```
[Agent] ──(error)──→ [Error Handler] → [Notify]
   ↓
[Continue]
```

### Retry Logic
Use loops with exit conditions:
```javascript
// Retry up to 3 times
{
  type: "loop",
  data: {
    maxIterations: 3,
    condition: "{{blocks.api.output.success}} !== true"
  }
}
```

## Human-in-the-Loop (HITL)

### Paused Executions
When HITL blocks trigger:
1. Execution enters `paused` state
2. User notified for input
3. Execution resumes after response

### Managing Paused Executions
```
GET /api/workflows/{id}/paused/{executionId}
POST /api/resume/{workflowId}/{executionId}
```

## Cancellation

Cancel running executions:
```
POST /api/workflows/{id}/executions/{executionId}/cancel
```

See `references/execution-api.md` for complete API reference.
See `references/debugging-guide.md` for troubleshooting patterns.
