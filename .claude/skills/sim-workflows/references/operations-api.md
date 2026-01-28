# Operations API Reference

Technical details about the REST operations endpoint used by sim-mcp.

## Endpoint

```
POST /api/v1/admin/workflows/{id}/operations
```

## Request Schema

```typescript
{
  operation: string        // Operation name (e.g., "batch-add-blocks", "add", "remove")
  target: string          // Target entity ("blocks", "block", "edge", "workflow", "variable", "subflow")
  payload: any            // Operation-specific data
  timestamp?: number      // Optional (defaults to Date.now())
  broadcast?: boolean     // Optional (defaults to true) - Send WebSocket notification
}
```

## Response Schema

```typescript
{
  success: boolean
  operationId: string     // Unique operation identifier
  timestamp: number       // Server timestamp
  broadcastSent: boolean  // Whether WebSocket notification was sent
  error?: string          // Present if success is false
}
```

## Supported Operations

### Block Operations (target: "blocks")

#### batch-add-blocks
Add multiple blocks with optional edges in a single operation.

**Payload:**
```typescript
{
  blocks: Array<{
    id?: string              // Auto-generated if omitted
    type: string             // Block type (agent, condition, etc.)
    name: string             // Display name
    position: { x: number, y: number }
    data?: any              // Block-specific configuration
    enabled?: boolean       // Default: true
  }>
  edges?: Array<{
    id?: string
    source: string          // Source block ID
    target: string          // Target block ID
    sourceHandle?: string   // Source output handle
    targetHandle?: string   // Target input handle
  }>
  loops?: Array<LoopConfig>
  parallels?: Array<ParallelConfig>
}
```

#### batch-remove-blocks
Remove multiple blocks and their connected edges.

**Payload:**
```typescript
{
  ids: string[]             // Array of block IDs to remove
}
```

#### batch-update-positions
Update positions of multiple blocks efficiently.

**Payload:**
```typescript
{
  updates: Array<{
    id: string
    position: { x: number, y: number }
  }>
}
```

### Single Block Operations (target: "block")

#### update-position
Update position of a single block.

**Payload:**
```typescript
{
  id: string
  position: { x: number, y: number }
  commit?: boolean          // Persist immediately (default: true)
}
```

#### update-name
Update block display name.

**Payload:**
```typescript
{
  id: string
  name: string
}
```

#### toggle-enabled
Enable or disable a block.

**Payload:**
```typescript
{
  id: string
  enabled: boolean
}
```

#### subblock-update
Update a subblock value within a block.

**Payload:**
```typescript
{
  id: string               // Block ID
  subblockId: string       // Subblock identifier
  value: any              // New value
}
```

#### update-wide
Update multiple block properties at once.

**Payload:**
```typescript
{
  id: string
  data?: any              // Block data
  subBlocks?: Record<string, { id: string, type: string, value: any }>
  outputs?: any           // Block outputs
  height?: number         // Canvas height
}
```

### Edge Operations (target: "edge")

#### add
Create connection between two blocks.

**Payload:**
```typescript
{
  id?: string              // Auto-generated if omitted
  source: string           // Source block ID
  target: string           // Target block ID
  sourceHandle?: string    // Output handle name
  targetHandle?: string    // Input handle name
}
```

#### remove
Remove connection between blocks.

**Payload:**
```typescript
{
  id: string               // Edge ID
}
```

### Workflow State Operations (target: "workflow")

#### replace-state
Replace entire workflow state. **Use with caution.**

**Payload:**
```typescript
{
  state: {
    blocks: Block[]
    edges: Edge[]
    variables?: Variable[]
    loops?: Loop[]
    parallels?: Parallel[]
    viewport?: { x: number, y: number, zoom: number }
  }
}
```

### Variable Operations (target: "variable")

#### add
Add workflow variable.

**Payload:**
```typescript
{
  id?: string
  name: string
  type: "string" | "number" | "boolean" | "object" | "array" | "plain"
  value: any
}
```

#### remove
Remove workflow variable.

**Payload:**
```typescript
{
  id: string
}
```

### Subflow Operations (target: "subflow")

#### add
Add loop or parallel subflow.

**Payload:**
```typescript
{
  id: string
  type: "loop" | "parallel"
  config?: {
    // Loop config
    iterableExpression?: string
    condition?: string
    maxIterations?: number
    
    // Parallel config
    waitForAll?: boolean
    timeout?: number
  }
}
```

#### update
Update subflow configuration.

**Payload:**
```typescript
{
  id: string
  type?: "loop" | "parallel"
  config?: any
}
```

#### remove
Remove subflow.

**Payload:**
```typescript
{
  id: string
}
```

## Error Handling

Operations return `success: false` with an error message when:
- Workflow not found
- Invalid operation or target
- Validation fails on payload
- Block/edge/variable not found
- Circular dependencies detected
- Database operation fails

**Example error response:**
```typescript
{
  success: false,
  operationId: "op_abc123",
  timestamp: 1704729600000,
  broadcastSent: false,
  error: "Block type 'invalid_type' is not supported"
}
```

## WebSocket Broadcasts

When `broadcast: true` (default), operations trigger WebSocket notifications to all connected clients viewing the workflow. This enables real-time collaborative editing.

**Broadcast message format:**
```typescript
{
  type: "workflow:operation",
  workflowId: string,
  operation: string,
  target: string,
  payload: any,
  operationId: string,
  timestamp: number
}
```

Clients receive broadcasts and can update their UI accordingly without polling.

## Rate Limiting

Operations endpoint has rate limiting to prevent abuse:
- 100 operations per minute per workflow
- 1000 operations per minute per workspace

Exceeding limits returns HTTP 429 with retry-after header.

## Idempotency

Operations include an `operationId` to prevent duplicate execution. If the same operation is submitted multiple times, subsequent requests are ignored and return the original result.

Use custom operation IDs for critical operations:
```typescript
{
  operation: "batch-add-blocks",
  target: "blocks",
  payload: { ... },
  operationId: "custom_op_123"  // Optional but recommended
}
```

## Performance Considerations

### Batch Operations
Use batch operations when possible:
- `batch-add-blocks` instead of multiple `add` calls
- `batch-remove-blocks` instead of multiple `remove` calls
- `batch-update-positions` for canvas layout changes

### Broadcasting
Disable broadcasting for bulk operations to reduce WebSocket load:
```typescript
{
  operation: "batch-add-blocks",
  target: "blocks",
  payload: { blocks: [...] },
  broadcast: false  // Skip WebSocket notification
}
```

### Transaction Safety
All operations are atomic - either the entire operation succeeds or fails. Partial application is not possible.

## Authentication

Operations endpoint requires authentication:
- **Hosted (sim.ai):** User API key in `Authorization: Bearer <token>` header
- **Self-hosted:** Internal API secret or user token depending on configuration

MCP server handles authentication automatically based on configuration.

## Validation Rules

### Block Validation
- `type` must be a supported block type
- `name` cannot be empty
- `position` must have numeric x and y values
- `id` must be unique within workflow (if provided)

### Edge Validation
- `source` and `target` blocks must exist
- Cannot create edge from block to itself
- Cannot create duplicate edges (same source, target, and handles)
- Handles must exist on the respective blocks (if specified)

### Variable Validation
- `name` must be unique within workflow
- `type` must be valid variable type
- `value` must match declared type

### Subflow Validation
- `id` must be unique within workflow
- `type` must be "loop" or "parallel"
- Configuration must match subflow type requirements

## Migration Notes

The operations endpoint replaces older individual REST endpoints:
- ❌ `POST /workflows/{id}/blocks` (deprecated)
- ❌ `DELETE /workflows/{id}/blocks/{id}` (deprecated)
- ❌ `POST /workflows/{id}/edges` (deprecated)
- ❌ `DELETE /workflows/{id}/edges/{id}` (deprecated)
- ✅ `POST /api/v1/admin/workflows/{id}/operations` (current)

Legacy endpoints may be removed in future versions.
