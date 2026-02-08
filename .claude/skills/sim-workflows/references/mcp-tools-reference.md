# MCP Tools Parameter Reference

Detailed parameter tables for all 21 sim-mcp tools. See [SKILL.md](../SKILL.md) for usage patterns and examples.

---

## Creation

### `create_workflow`

Create a new empty workflow.

```
create_workflow({ name: "My Workflow", workspaceId: "ws_id" })
→ { id: "wf_abc123", name: "My Workflow" }
```

| Param | Required | Description |
|-------|----------|-------------|
| `name` | ✅ | Display name |
| `workspaceId` | ✅ | Workspace to create in |
| `description` | | Optional description |
| `color` | | Hex color (default: `#3972F6`) |
| `folderId` | | Folder placement |

---

## Building

### `add_blocks`

Add one or more blocks with optional edges in a single call.

```
add_blocks({
  workflowId: "wf_abc",
  blocks: [
    { type: "agent", name: "Agent 1", position: { x: 400, y: 300 } }
  ],
  edges: [
    { id: "e1", source: "starter_id", target: "new_block_id" }
  ]
})
```

| Param | Required | Description |
|-------|----------|-------------|
| `workflowId` | ✅ | Target workflow |
| `blocks` | ✅ | Array of `{ type, name, position: {x,y}, data?, enabled?, id? }` |
| `edges` | | Optional edges to create simultaneously |

Blocks are created with empty subBlocks. Use `update_subblock` to configure each block after creation. SubBlock IDs are listed in the Block Types Reference — they cannot be discovered via `get_block` on a freshly created block (subBlocks appear in `get_block` only after they've been set).

### `add_edge`

Connect two blocks.

```
add_edge({ workflowId: "wf_abc", source: "block_a", target: "block_b" })
```

| Param | Required | Description |
|-------|----------|-------------|
| `workflowId` | ✅ | Target workflow |
| `source` | ✅ | Source block ID |
| `target` | ✅ | Target block ID |
| `sourceHandle` | | For condition/router branches (e.g., `"condition-cond_1"`, `"route-0"`) |
| `targetHandle` | | Target input handle |
| `edgeId` | | Custom edge ID |

### `add_variable`

Add a workflow variable.

```
add_variable({ workflowId: "wf_abc", name: "apiUrl", type: "string", value: "https://api.example.com" })
```

| Param | Required | Description |
|-------|----------|-------------|
| `workflowId` | ✅ | Target workflow |
| `name` | ✅ | Variable name |
| `type` | ✅ | `string`, `number`, `boolean`, `object`, `array`, `plain` |
| `value` | ✅ | Initial value |
| `id` | | Custom variable ID |

Reference in blocks: `<variable.apiUrl>`

---

## Configuration

### `update_subblock`

Set a block's configuration field. This is the primary way to configure blocks after creation. Each block type has specific subblock IDs (see Block Types Reference).

```
update_subblock({
  workflowId: "wf_abc",
  blockId: "block_1",
  subblockId: "systemPrompt",
  value: "You are a helpful assistant."
})
```

| Param | Required | Description |
|-------|----------|-------------|
| `workflowId` | ✅ | Target workflow |
| `blockId` | ✅ | Block to configure |
| `subblockId` | ✅ | SubBlock identifier (from Block Types Reference) |
| `value` | ✅ | New value for the subblock |

### `update_block_name`

Rename a block.

```
update_block_name({ workflowId: "wf_abc", blockId: "block_1", name: "Customer Support Agent" })
```

### `toggle_block_enabled`

Enable or disable a block in a workflow. Disabled blocks are skipped during workflow execution but retain their configuration, connections, and position.

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| `workflowId` | ✅ | string | ID of the workflow containing the block |
| `blockId` | ✅ | string | ID of the block to toggle |
| `enabled` | ✅ | boolean | `true` to enable, `false` to disable |

**Returns:** `{ success: boolean, operationId: string }`

```
// Disable a block
toggle_block_enabled({ workflowId: "wf_abc", blockId: "block_1", enabled: false })

// Re-enable a block
toggle_block_enabled({ workflowId: "wf_abc", blockId: "block_1", enabled: true })
```

**Use cases:** Disable email/Slack/webhook blocks during testing, A/B test branches, isolate failures. See [SKILL.md Best Practices](../SKILL.md#disabling-blocks-for-safe-testing) for patterns.

---

## Execution

### `execute_workflow`

Run a workflow and return the result.

```
execute_workflow({
  workflowId: "wf_abc",
  input: { message: "Hello!" },
  triggerType: "api"
})
```

| Param | Required | Default | Description |
|-------|----------|---------|-------------|
| `workflowId` | ✅ | | Workflow to execute |
| `input` | | `{}` | Input data passed to trigger |
| `triggerType` | | `"api"` | Trigger type: `api`, `manual`, `schedule`, `chat`, `webhook`, `mcp`, `a2a` |
| `useDraftState` | | `true` | Use draft (unsaved) state. Set `true` to run without deploying |

**Key:** `useDraftState: true` (default) executes the current draft, so deployment is NOT required for testing.

**Return values:**
- **Success:** `{ success: true, executionId: "...", output: {...}, metadata: { duration, startTime, endTime } }`
- **Error:** `{ code: "INTERNAL_ERROR", message: "Request failed with status code 500" }` — check execution logs for details

---

## Monitoring

### `get_execution_logs`

List and filter execution logs.

```
get_execution_logs({
  workspaceId: "ws_id",
  workflowId: "wf_abc",
  level: "error",
  details: "full",
  includeTraceSpans: true,
  includeFinalOutput: true,
  limit: 10
})
```

| Param | Required | Description |
|-------|----------|-------------|
| `workspaceId` | ✅ | Workspace ID |
| `workflowId` | | Filter by workflow |
| `executionId` | | Filter by specific execution |
| `level` | | `"info"` or `"error"` |
| `details` | | `"basic"` (summary) or `"full"` (includes execution data) |
| `includeTraceSpans` | | Per-block execution traces (requires `details: "full"`) |
| `includeFinalOutput` | | Include final workflow output (requires `details: "full"`) |
| `trigger` | | Filter by trigger type |
| `startDate` / `endDate` | | ISO 8601 date range |
| `minDurationMs` / `maxDurationMs` | | Duration filters |
| `minCost` / `maxCost` | | Cost filters |
| `limit` | | Max results (default: 100) |
| `cursor` | | Pagination cursor |
| `order` | | `"desc"` (default) or `"asc"` |

### `get_execution_log_detail`

Get comprehensive detail for one execution.

```
get_execution_log_detail({ logId: "log_xyz" })
```

Returns: execution data, workflow context, cost breakdown, trace spans, final output.

---

## Inspection

### `list_workflows`

List workflows with pagination.

```
list_workflows({ workspaceId: "ws_id", limit: 50, offset: 0 })
```

### `get_workflow`

Get workflow structure (blocks, edges, variables).

```
get_workflow({ workflowId: "wf_abc", verbose: false })
```

- `verbose: false` (default): Lightweight block metadata — use for discovering block IDs and connections
- `verbose: true`: Full block config including subBlocks — WARNING: can be very large
- **Prefer:** `get_workflow(verbose: false)` + `get_block(blockId)` for targeted inspection

### `get_block`

Get full detail for a single block.

```
get_block({ workflowId: "wf_abc", blockId: "block_1" })
```

Returns complete block config including all subBlocks and their current values.

---

## Removal

### `remove_blocks`

Remove blocks and their connected edges.

```
remove_blocks({ workflowId: "wf_abc", blockIds: ["block_1", "block_2"] })
```

### `remove_edge`

Remove a connection.

```
remove_edge({ workflowId: "wf_abc", edgeId: "edge_1" })
```

### `remove_variable`

Remove a workflow variable.

```
remove_variable({ workflowId: "wf_abc", variableId: "var_1" })
```

---

## Advanced

### `replace_workflow_state`

Overwrite entire workflow state. Use for major restructuring, restoring from backup, template application. Prefer targeted operations for normal edits.

```
replace_workflow_state({ workflowId: "wf_abc", state: { blocks, edges, loops, parallels } })
```

### `update_subflow`

Update loop/parallel configuration. Subflows are created via `add_blocks` with `type: "loop"` or `type: "parallel"`. This tool only updates existing ones.

```
update_subflow({ workflowId: "wf_abc", id: "loop_1", type: "loop", config: { ... } })
```

### `list_custom_tools`

List custom tools in a workspace.

```
list_custom_tools({ workspaceId: "ws_id" })
```

### `upsert_custom_tools`

Create or update custom tools.

```
upsert_custom_tools({
  workspaceId: "ws_id",
  tools: [{
    title: "My Tool",
    schema: { type: "function", function: { name: "my_tool", parameters: { ... } } },
    code: "async function execute(params) { ... }"
  }]
})
```
