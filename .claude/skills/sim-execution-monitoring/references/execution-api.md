# Execution API Reference

Complete API reference for workflow execution and monitoring.

## Execute Workflow

### POST /api/workflows/{id}/execute

Execute a workflow with optional input.

**Headers:**
```
Authorization: Bearer {api_key}
Content-Type: application/json
```

**Request Body:**
```json
{
  "input": {},                    // Workflow input data
  "selectedOutputs": [],          // Block outputs to include
  "triggerType": "api",           // api | webhook | schedule | manual
  "stream": true,                 // Enable SSE streaming (default: false)
  "useDraftState": false          // Use draft or deployed state
}
```

**Response (sync):**
```json
{
  "success": true,
  "output": {
    "blockId_fieldName": "value"
  },
  "metadata": {
    "duration": 1234,
    "startTime": "2024-01-15T10:30:00.000Z",
    "endTime": "2024-01-15T10:30:01.234Z"
  }
}
```

**Response (async - 202 Accepted):**
```json
{
  "success": true,
  "async": true,
  "jobId": "job_abc123",
  "message": "Workflow execution queued",
  "statusUrl": "/api/jobs/job_abc123"
}
```

## Webhook Trigger

### POST /api/webhooks/trigger/{path}

Trigger workflow via configured webhook.

**Response:**
Same as execute endpoint.

## Logs API

### GET /api/logs

Retrieve execution logs for a workspace.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `workspaceId` | string | Required. Workspace ID |
| `limit` | number | Max results (default: 100) |
| `offset` | number | Pagination offset |
| `details` | string | `basic` or `full` |
| `level` | string | `info,error,running,pending` |
| `workflowIds` | string | Comma-separated IDs |
| `trigger` | string | `api,webhook,schedule,manual` |
| `dateFrom` | string | ISO timestamp |
| `dateTo` | string | ISO timestamp |
| `search` | string | Search term |

**Response:**
```json
{
  "data": [
    {
      "id": "log_123",
      "executionId": "exec_abc",
      "workflowId": "wf_xyz",
      "status": "completed",
      "trigger": "api",
      "duration": "1234ms",
      "createdAt": "2024-01-15T10:30:00.000Z",
      "cost": {
        "total": 0.0012
      },
      "workflow": {
        "id": "wf_xyz",
        "name": "My Workflow"
      }
    }
  ],
  "total": 150,
  "page": 1,
  "pageSize": 100,
  "totalPages": 2
}
```

### GET /api/logs/{id}

Get single log entry with full details.

**Response (details=full):**
```json
{
  "id": "log_123",
  "executionId": "exec_abc",
  "executionData": {
    "traceSpans": [
      {
        "id": "span_1",
        "name": "Agent Block",
        "type": "agent",
        "duration": 850,
        "startTime": "2024-01-15T10:30:00.100Z",
        "status": "success",
        "input": { "prompt": "..." },
        "output": { "response": "..." },
        "tokens": 150
      }
    ],
    "finalOutput": { ... }
  },
  "cost": {
    "total": 0.0012,
    "input": 0.0008,
    "output": 0.0004,
    "tokens": {
      "total": 150,
      "input": 100,
      "output": 50
    }
  }
}
```

### GET /api/logs/execution/{executionId}

Get logs by execution ID.

## Job Status (Async Execution)

### GET /api/jobs/{jobId}

Check status of async execution.

**Response:**
```json
{
  "id": "job_abc123",
  "status": "completed",  // queued | running | completed | failed
  "output": { ... },
  "error": null,
  "createdAt": "2024-01-15T10:30:00.000Z",
  "completedAt": "2024-01-15T10:30:05.000Z"
}
```

## Paused Executions

### GET /api/workflows/{id}/paused/{executionId}

Get paused execution details.

**Response:**
```json
{
  "executionId": "exec_abc",
  "status": "paused",
  "pausePoints": [
    {
      "blockId": "hitl_block",
      "message": "Approval needed",
      "options": ["Approve", "Reject"]
    }
  ]
}
```

### POST /api/resume/{workflowId}/{executionId}

Resume paused execution.

**Request Body:**
```json
{
  "response": "Approve",
  "contextId": "ctx_123"  // For multi-pause scenarios
}
```

## Cancel Execution

### POST /api/workflows/{id}/executions/{executionId}/cancel

Cancel a running execution.

**Response:**
```json
{
  "success": true,
  "message": "Execution cancelled"
}
```

## Metrics

### GET /api/workspaces/{id}/metrics/executions

Get execution metrics for workspace.

**Query Parameters:**
| Param | Type | Description |
|-------|------|-------------|
| `period` | string | `day`, `week`, `month` |
| `workflowId` | string | Filter by workflow |

**Response:**
```json
{
  "totalExecutions": 1500,
  "successRate": 0.95,
  "avgDuration": 1234,
  "totalCost": 12.50,
  "byDay": [
    { "date": "2024-01-15", "count": 150, "errors": 5 }
  ]
}
```

## SSE Event Types

When streaming is enabled:

| Event | Description |
|-------|-------------|
| `execution:started` | Workflow execution began |
| `block:started` | Block execution began |
| `block:completed` | Block finished successfully |
| `block:error` | Block failed |
| `stream:chunk` | LLM streaming chunk |
| `stream:done` | LLM streaming complete |
| `execution:completed` | Workflow finished |
| `execution:error` | Workflow failed |
| `execution:cancelled` | Execution was cancelled |

**Event Format:**
```
event: block:completed
data: {"blockId":"agent_1","output":{...},"durationMs":850}

```
