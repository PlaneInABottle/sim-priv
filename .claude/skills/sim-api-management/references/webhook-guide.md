# Webhook Configuration Guide

Complete guide for setting up and managing webhooks in Sim.

## Generic Webhook Setup

### Creating a Webhook Trigger

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "generic_webhook",
    name: "Webhook Receiver",
    position: { x: 100, y: 100 },
    data: {
      requireAuth: true,
      token: "wh_secret_abc123",
      secretHeaderName: "X-Webhook-Secret",
      inputFormat: {
        "event": {
          "type": "string",
          "description": "Event type identifier"
        },
        "timestamp": {
          "type": "string",
          "description": "ISO 8601 timestamp"
        },
        "data": {
          "type": "object",
          "description": "Event payload",
          "properties": {}
        }
      }
    }
  }]
})
```

### Configuration Options

| Option | Type | Description |
|--------|------|-------------|
| `requireAuth` | boolean | Enable authentication |
| `token` | string | Secret token for verification |
| `secretHeaderName` | string | Custom header name (optional) |
| `inputFormat` | object | Expected payload schema |

## Input Format Schema Patterns

### Object Fields

Define nested objects with `properties`:

```javascript
{
  "sender": {
    "type": "object",
    "description": "Sender contact",
    "properties": {
      "id": { "type": "number" },
      "email": { "type": "string" }
    }
  }
}
```

### Array Fields

Arrays contain a list of typed objects. Wrap the item schema in `[]`:

```javascript
{
  "attachments": {
    "type": "array",
    "description": "File attachments",
    // In the UI/MCP tools, value becomes: [{ "type": "object", "properties": {...} }]
  }
}
```

**Full Array Example:**
```json
{
  "attachments": {
    "type": "array",
    "description": "Message attachments",
    "value": [
      {
        "type": "object",
        "description": "Attachment item",
        "properties": {
          "id": {
            "type": "string",
            "description": "Attachment ID"
          },
          "filename": {
            "type": "string",
            "description": "File name"
          },
          "size": {
            "type": "number",
            "description": "File size in bytes"
          },
          "mime_type": {
            "type": "string",
            "description": "MIME type"
          }
        }
      }
    ]
  }
}
```

## Authentication Methods

### Bearer Token (Default)

If `secretHeaderName` is not set:

```bash
curl -X POST \
  -H "Authorization: Bearer wh_secret_abc123" \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "data": {...}}' \
  https://{your-domain}/api/webhooks/{webhookPath}
```

### Custom Header

With `secretHeaderName: "X-Webhook-Secret"`:

```bash
curl -X POST \
  -H "X-Webhook-Secret: wh_secret_abc123" \
  -H "Content-Type: application/json" \
  -d '{"event": "order.created", "data": {...}}' \
  https://{your-domain}/api/webhooks/{webhookPath}
```

## Event Subscriptions

### Routing by Event Type

Use condition blocks to route different events:

```javascript
// Add router for event types
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "router",
    name: "Event Router",
    position: { x: 300, y: 100 },
    data: {
      routes: [
        { condition: "{{input.event}} === 'order.created'", label: "Order Created" },
        { condition: "{{input.event}} === 'order.updated'", label: "Order Updated" },
        { condition: "{{input.event}} === 'order.cancelled'", label: "Order Cancelled" }
      ]
    }
  }]
})
```

### Event Handler Pattern

```javascript
// Separate agent blocks for each event type
add_blocks({
  workflowId: "wf_123",
  blocks: [
    {
      id: "order_created_handler",
      type: "agent",
      name: "Handle Order Created",
      position: { x: 500, y: 50 },
      data: {
        systemPrompt: "Process new order: {{blocks.webhook.output.data}}"
      }
    },
    {
      id: "order_updated_handler",
      type: "agent",
      name: "Handle Order Updated",
      position: { x: 500, y: 150 },
      data: {
        systemPrompt: "Update order record: {{blocks.webhook.output.data}}"
      }
    }
  ]
})
```

## Payload Formats

### Standard Webhook Payload

```json
{
  "event": "resource.action",
  "timestamp": "2024-01-15T10:30:00Z",
  "id": "evt_abc123",
  "data": {
    "id": "resource_id",
    "attributes": {}
  }
}
```

### Accessing Payload Data

```
{{blocks.webhook.output.event}}
{{blocks.webhook.output.data.id}}
{{blocks.webhook.output.data.attributes.name}}
```

### Common Third-Party Formats

**Stripe:**
```json
{
  "type": "payment_intent.succeeded",
  "data": {
    "object": {
      "id": "pi_xxx",
      "amount": 2000
    }
  }
}
```

**GitHub:**
```json
{
  "action": "opened",
  "issue": {
    "number": 1,
    "title": "Bug report"
  },
  "repository": {
    "full_name": "owner/repo"
  }
}
```

**Slack:**
```json
{
  "type": "event_callback",
  "event": {
    "type": "message",
    "text": "Hello",
    "channel": "C123"
  }
}
```

## Security Best Practices

### Token Management

1. **Generate strong tokens** - Use cryptographically random strings
2. **Rotate regularly** - Update tokens periodically
3. **Store securely** - Use workflow variables for tokens

```javascript
add_variable({
  workflowId: "wf_123",
  name: "webhookSecret",
  type: "string",
  value: "wh_secret_xxx"
})
```

### Signature Verification

For services that sign payloads (Stripe, GitHub):

```javascript
// Code block for signature verification
const crypto = require('crypto');

const signature = headers['x-hub-signature-256'];
const payload = JSON.stringify(body);
const secret = variables.webhookSecret;

const expected = 'sha256=' + crypto
  .createHmac('sha256', secret)
  .update(payload)
  .digest('hex');

if (signature !== expected) {
  return { error: 'Invalid signature', valid: false };
}

return { valid: true, data: body };
```

### IP Allowlisting

Document expected source IPs for external services:

```javascript
// Agent prompt for IP validation
const allowedIPs = ['192.168.1.1', '10.0.0.0/8'];
const clientIP = headers['x-forwarded-for'];

// Validate IP is in allowed list
```

## Retry Handling

### Idempotent Processing

Always design for at-least-once delivery:

```javascript
inputFormat: {
  "eventId": {
    "type": "string",
    "description": "Unique event ID for deduplication"
  },
  "event": {
    "type": "string",
    "description": "Event type"
  },
  "data": {
    "type": "object",
    "description": "Event payload",
    "properties": {}
  }
}
```

### Responding Quickly

Return 200 immediately, process async:

```javascript
// Response block at start of workflow
{
  type: "response",
  data: {
    body: '{"received": true}'
  }
}
```

## Service-Specific Triggers

Sim provides pre-built triggers for common services:

| Service | Block Type | Events |
|---------|------------|--------|
| Stripe | `stripe` | Payment events |
| GitHub | `github` | Repository events |
| Slack | `slack` | Message events |
| Linear | `linear` | Issue events |
| Jira | `jira` | Issue/project events |

### Using Service Triggers

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "stripe",
    name: "Stripe Payments",
    position: { x: 100, y: 100 },
    data: {
      events: ["payment_intent.succeeded", "payment_intent.failed"]
    }
  }]
})
```

## Debugging Webhooks

### Logging Incoming Requests

Add an agent block to log requests:

```
Log this webhook request for debugging:
- Event: {{blocks.webhook.output.event}}
- Timestamp: {{blocks.webhook.output.timestamp}}
- Payload: {{blocks.webhook.output.data}}

Return the logged data as-is.
```

### Testing with curl

```bash
# Test webhook locally
curl -X POST \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your-token" \
  -d '{"event": "test", "data": {"key": "value"}}' \
  https://{your-domain}/api/webhooks/{webhookPath}
```

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Invalid token | Verify token matches |
| 400 Bad Request | Invalid JSON | Check payload format |
| Timeout | Slow processing | Return 200 early |
| Duplicate events | No deduplication | Check eventId |
