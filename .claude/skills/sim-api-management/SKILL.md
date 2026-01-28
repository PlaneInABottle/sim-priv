---
name: sim-api-management
description: Use when configuring API triggers, designing REST endpoints, setting up webhooks, or implementing API best practices in Sim workflows.
---

# Sim API Management

Guide for API trigger configuration, REST endpoint design, and webhook integration in Sim workflows.

## Start Block

The Start block exposes your workflow as an HTTP endpoint (supports chat, manual, and API runs).

### Basic Configuration

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "start_trigger",
    name: "Start",
    position: { x: 100, y: 100 },
    data: {
      inputFormat: {
        "message": {
          "type": "string",
          "description": "User message"
        },
        "userId": {
          "type": "string",
          "description": "User ID"
        }
      }
    }
  }]
})
```

### Endpoint URL

After deployment, your workflow is accessible at:
```
POST https://{your-domain}/api/workflows/{workflowId}/execute
```

### Calling the API

```bash
curl -X POST \
  -H "X-API-Key: $SIM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"message": "Hello", "userId": "user_123"}' \
  https://{your-domain}/api/workflows/{workflowId}/execute
```

## Generic Webhook Trigger

Receive webhooks from external services.

### Configuration

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "generic_webhook",
    name: "Webhook Receiver",
    position: { x: 100, y: 100 },
    data: {
      requireAuth: true,
      token: "your-secret-token",
      secretHeaderName: "X-Webhook-Secret",
      inputFormat: {
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
    }
  }]
})
```

### Webhook URL

Each webhook trigger generates a unique URL:
```
POST https://{your-domain}/api/webhooks/{webhookPath}
```

## Input Format Schema

Define expected input structure for validation and type safety.

### Supported Types

| Type | Description | Example |
|------|-------------|---------|
| `string` | Text values | `"hello"` |
| `number` | Numeric values | `42` |
| `boolean` | True/false | `true` |
| `object` | Nested objects | `{"key": "value"}` |
| `array` | Lists of objects | `[{...}, {...}]` |
| `files` | File uploads | Base64 or URL |

### Array Type Schema

Arrays define a collection of typed objects. Use this pattern for lists of items like attachments, messages, or labels.

**Array Format:**
```json
{
  "attachments": {
    "type": "array",
    "description": "File attachments",
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

**Key Points:**
- Array field has `"type": "array"`
- Value is wrapped in `[]` brackets
- Contains object definition with `type: "object"` and `properties`
- Each property follows standard type/description rules
- Can include nested objects within array items

**Using in Webhooks:**
```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "generic_webhook",
    name: "Webhook with Attachments",
    position: { x: 100, y: 100 },
    data: {
      inputFormat: {
        "event": {
          "type": "string",
          "description": "Event type"
        },
        "attachments": {
          "type": "array",
          "description": "File attachments"
          // Note: In UI, this becomes value: [{ properties }]
        }
      }
    }
  }]
})
```

### File Input Example

```javascript
inputFormat: {
  documents: { type: "files", description: "Upload documents" },
  instructions: { type: "string", description: "Processing instructions" }
}
```

Files are passed as:
```json
{
  "type": "file",
  "data": "data:application/pdf;base64,base64data",
  "name": "document.pdf",
  "mime": "application/pdf"
}
```

## Authentication

### API Key Authentication

All workflow executions require an API key:
```bash
-H "X-API-Key: YOUR_API_KEY"
```

### Webhook Authentication

Webhooks support two authentication methods:

**Bearer Token:**
```bash
-H "Authorization: Bearer your-secret-token"
```

**Custom Header:**
```bash
-H "X-Webhook-Secret: your-secret-token"
```

## Accessing Input Data

Reference input values in subsequent blocks:

```
{{blocks.start.output.message}}
{{blocks.webhookReceiver.output.data.userId}}
```

## Response Configuration

Use a Response block to return data:

```javascript
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "response",
    name: "API Response",
    position: { x: 500, y: 100 },
    data: {
      body: "{{blocks.agent.output.result}}"
    }
  }]
})
```

## Best Practices

1. **Define input schemas** - Explicit schemas improve documentation and validation
2. **Use authentication** - Always enable auth for production webhooks
3. **Handle errors gracefully** - Use condition blocks for error paths
4. **Set timeouts** - Configure appropriate timeouts for long-running workflows
5. **Version your APIs** - Include version in workflow naming for breaking changes

See `references/api-design.md` for detailed API design patterns.
See `references/webhook-guide.md` for webhook configuration details.
See `examples/api-templates.json` for ready-to-use templates.
