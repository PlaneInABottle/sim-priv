---
name: sim-workflows
description: Use when building or modifying Sim workflows programmatically via MCP tools - adding/removing blocks, connecting edges, managing workflow state, importing/exporting workflows, or automating workflow creation. Provides comprehensive guide for all sim-mcp operations including block types, API operations, variables, subflows, templates, and best practices.
license: Complete terms in LICENSE.txt
---

# AI-Native Workflow Management

Autonomous guide for creating, building, executing, and monitoring Sim Studio workflows via the 21 sim-mcp tools. All operations update the UI in real-time.

## Workflow Lifecycle

```
Create → Build → Configure → Execute → Monitor → Debug → Iterate
```

| Phase | Tools | Purpose |
|-------|-------|---------|
| **Create** | `create_workflow` | Create empty workflow |
| **Build** | `add_blocks`, `add_edge`, `add_variable` | Add blocks, connect them, define variables |
| **Configure** | `update_subblock`, `update_block_name`, `toggle_block_enabled` | Set block parameters |
| **Execute** | `execute_workflow` | Run with any trigger type |
| **Monitor** | `get_execution_logs`, `get_execution_log_detail` | Retrieve logs, trace spans, costs |
| **Inspect** | `list_workflows`, `get_workflow`, `get_block` | Read workflow state |
| **Manage** | `remove_blocks`, `remove_edge`, `remove_variable` | Remove components |
| **Advanced** | `replace_workflow_state`, `update_subflow`, `list_custom_tools`, `upsert_custom_tools` | Bulk ops, loops, custom tools |

---

## All 21 MCP Tools

### Creation

**`create_workflow`** — Create a new empty workflow
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

### Building

**`add_blocks`** — Add one or more blocks with optional edges in a single call
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

Blocks are created with empty subBlocks. Use `update_subblock` to configure each block after creation. SubBlock IDs are listed in the Block Types Reference below — they cannot be discovered via `get_block` on a freshly created block (subBlocks appear in `get_block` only after they've been set).

**`add_edge`** — Connect two blocks
```
add_edge({ workflowId: "wf_abc", source: "block_a", target: "block_b" })
```
| Param | Required | Description |
|-------|----------|-------------|
| `workflowId` | ✅ | Target workflow |
| `source` | ✅ | Source block ID |
| `target` | ✅ | Target block ID |
| `sourceHandle` | | For condition/router branches (e.g., `"true"`, `"false"`, `"route-0"`) |
| `targetHandle` | | Target input handle |
| `edgeId` | | Custom edge ID |

**`add_variable`** — Add a workflow variable
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

### Configuration

**`update_subblock`** — Set a block's configuration field
```
update_subblock({
  workflowId: "wf_abc",
  blockId: "block_1",
  subblockId: "systemPrompt",
  value: "You are a helpful assistant."
})
```
This is the primary way to configure blocks after creation. Each block type has specific subblock IDs (see Block Types Reference below).

**`update_block_name`** — Rename a block
```
update_block_name({ workflowId: "wf_abc", blockId: "block_1", name: "Customer Support Agent" })
```

**`toggle_block_enabled`** — Enable/disable a block (disabled blocks are skipped during execution)
```
toggle_block_enabled({ workflowId: "wf_abc", blockId: "block_1", enabled: false })
```

### Execution

**`execute_workflow`** — Run a workflow and return the result
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

### Monitoring

**`get_execution_logs`** — List and filter execution logs
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

**`get_execution_log_detail`** — Get comprehensive detail for one execution
```
get_execution_log_detail({ logId: "log_xyz" })
```
Returns: execution data, workflow context, cost breakdown, trace spans, final output.

### Inspection

**`list_workflows`** — List workflows with pagination
```
list_workflows({ workspaceId: "ws_id", limit: 50, offset: 0 })
```

**`get_workflow`** — Get workflow structure (blocks, edges, variables)
```
get_workflow({ workflowId: "wf_abc", verbose: false })
```
- `verbose: false` (default): Lightweight block metadata — use for discovering block IDs and connections
- `verbose: true`: Full block config including subBlocks — WARNING: can be very large
- **Prefer:** `get_workflow(verbose: false)` + `get_block(blockId)` for targeted inspection

**`get_block`** — Get full detail for a single block
```
get_block({ workflowId: "wf_abc", blockId: "block_1" })
```
Returns complete block config including all subBlocks and their current values. Use this instead of `verbose: true` on `get_workflow`.

### Removal

**`remove_blocks`** — Remove blocks and their connected edges
```
remove_blocks({ workflowId: "wf_abc", blockIds: ["block_1", "block_2"] })
```

**`remove_edge`** — Remove a connection
```
remove_edge({ workflowId: "wf_abc", edgeId: "edge_1" })
```

**`remove_variable`** — Remove a workflow variable
```
remove_variable({ workflowId: "wf_abc", variableId: "var_1" })
```

### Advanced

**`replace_workflow_state`** — Overwrite entire workflow state
```
replace_workflow_state({ workflowId: "wf_abc", state: { blocks, edges, loops, parallels } })
```
Use for: major restructuring, restoring from backup, template application. Prefer targeted operations for normal edits.

**`update_subflow`** — Update loop/parallel configuration
```
update_subflow({ workflowId: "wf_abc", id: "loop_1", type: "loop", config: { ... } })
```
Note: Subflows are created via `add_blocks` with `type: "loop"` or `type: "parallel"`. This tool only updates existing ones.

**`list_custom_tools`** — List custom tools in a workspace
```
list_custom_tools({ workspaceId: "ws_id" })
```

**`upsert_custom_tools`** — Create or update custom tools
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

---

## Data Reference Syntax

### Block Output Tags

Reference outputs from other blocks using angle brackets with the block's display name:

```
<Agent 1.content>          — Agent's text response
<API Block.data>           — API response data
<API Trigger.message>      — Trigger input field (from inputFormat)
<API Trigger.input>        — Full trigger input object
<Function 1.result>        — Function return value (always .result, not .output)
```

**Output field names by block type:**

| Block Type | Output Fields |
|-----------|--------------|
| `agent` | `.content` (response text) |
| `function` | `.result` (return value), `.stdout` (console output) |
| `api_trigger` | `.input` (full input object), plus spread top-level fields from inputFormat, optional `.files` |
| `api` | `.data` (response body), `.status`, `.headers` |
| `condition` | `.conditionResult` (boolean), `.selectedPath` (object with blockId/blockType/blockTitle), `.selectedOption` (matched condition ID); also spreads source block output |
| `response` | `.data`, `.status`, `.headers` |

**Rules:**
- Use the block's **display name** (not its ID)
- Case-sensitive; spaces in block names work in agent/response fields but **not** inside function block code
- Supports dot notation for nested fields
- In function block code, tags are replaced with **safe variable references** before execution (e.g., `<Agent.content>` becomes a variable `__tag_Agent_0content` holding the actual value — NOT an inline string literal)
- In function code, block names must use only `[a-zA-Z0-9_.]` — no spaces (use underscore names like `My_Block`)

### Workflow Variables

```
<variable.myVar>           — In block tag references
{{variable.myVar}}         — In template text fields
```

---

## Block Types Reference

### Trigger Blocks

Every workflow needs exactly one trigger block as the entry point.

| Type | Name | Purpose | Key SubBlocks |
|------|------|---------|---------------|
| `starter` | Starter | Call another workflow as subflow | `startWorkflow` |
| `start_trigger` | Start | Generic start point | `inputFormat` |
| `api_trigger` | API Trigger | HTTP API entry point | `inputFormat` |
| `generic_webhook` | Webhook | Receive webhooks from external services | (dynamic from payload) |
| `chat_trigger` | Chat | Chat interface entry | (none — outputs: `input`, `conversationId`, `files`) |
| `schedule` | Schedule | Time-based trigger | `scheduleType`, `cronExpression`, `timezone` |

**⚠️ Trigger / execute_workflow compatibility:**
- `triggerType: "api"` → requires `api_trigger` block (NOT `generic_webhook`)
- `triggerType: "webhook"` → requires `generic_webhook` block
- `triggerType: "chat"` → requires `chat_trigger` block
- `triggerType: "manual"` → works with most trigger types

Using the wrong trigger block type returns: `"No start block found. Add a start block to this workflow."`

### Core Logic Blocks

| Type | Name | Purpose | Key SubBlocks |
|------|------|---------|---------------|
| `agent` | Agent | LLM with tool calling | `model`, `systemPrompt`, `messages`, `tools`, `responseFormat`, `temperature`, `maxTokens` |
| `function` | Function | Execute JS/Python code | `language`, `code` |

### Function Block Runtime Environment

Inside function block code, these variables are available:
- **`params`** — always `{}` for regular function blocks (only populated for custom tool executions)
- **`<BlockName.field>`** — tag syntax for referencing other block outputs (replaced with variable references before execution)
- **`console`** — sandboxed `console.log/error/warn/info`
- **`fetch`** — sandboxed fetch function (SSRF-validated)
- **`environmentVariables`** — object containing environment variables

**Data flow between blocks:** Previous block outputs are NOT available via `params`. Use tag syntax `<BlockName.field>` embedded directly in the code string. Tags are replaced with safe variable references holding the actual values before the code executes.

**Example:**
```javascript
// Tags are replaced with variable references before execution
const message = <API_Trigger.message>;  // becomes a variable holding the actual value
const result = <Classifier.result>;     // becomes a variable holding classifier output
return { processed: true, data: message };
```

**Output:** Function return values are wrapped as `{ result: <returnValue>, stdout: "" }`. Reference from other blocks using `<FunctionName.result>`.
| `condition` | Condition | Boolean branching | `conditions` |
| `router` | Router | Multi-path routing (LLM-based) | `prompt`, `model` |
| `response` | Response | Return workflow output | `data`, `dataMode`, `builderData`, `status`, `headers` |

### Response Block Modes

The response block has two modes controlled by the `dataMode` subblock:
- **`structured`** (default) — Uses `builderData` subblock with typed property rows
- **`json`** — Uses `data` subblock as a raw JSON code editor with tag references

**For programmatic use, set `dataMode` to `"json"` first**, then set the `data` subblock with your JSON containing tag references:
```
update_subblock(blockId, "dataMode", "json")
update_subblock(blockId, "data", '{"result": "<Agent.content>", "meta": "<Function.result>"}')
```
| `api` | API | HTTP requests | `url`, `method`, `headers`, `body`, `params`, `timeout` |

### Agent Block SubBlocks (Most Common)

| SubBlock ID | Type | Description |
|-------------|------|-------------|
| `model` | combobox | LLM model (e.g., `gpt-4o`, `claude-sonnet-4-20250514`) |
| `systemPrompt` | long-input | System instructions |
| `messages` | messages-input | Conversation messages with role/content |
| `tools` | tool-input | Tools the agent can call |
| `responseFormat` | code | JSON schema for structured output |
| `temperature` | slider | 0-2, controls randomness |
| `maxTokens` | short-input | Max response tokens |
| `apiKey` | short-input | Provider API key |

**⚠️ Agent blocks REQUIRE `apiKey` and `model` for execution.** Missing either causes a runtime error when the block attempts to call the LLM provider (validated in `getApiKeyWithBYOK()` and the provider's `executeRequest()`). Set both before executing.

**Messages format:** The `messages` subblock accepts an array of message objects:
```
[{ "role": "user", "content": "Your message here with <BlockName.field> tags" }]
```

### Condition Block

The `conditions` subblock takes an array of condition objects:
```
[
  { "id": "cond_1", "title": "if", "value": "<SomeBlock.result.field> === true" },
  { "id": "cond_2", "title": "else if", "value": "<SomeBlock.result.field> === 'other'" },
  { "id": "cond_3", "title": "else", "value": "" }
]
```

Source handles for edges use the format `"condition-{id}"` where `{id}` matches the condition object's `id` field:
- `"condition-cond_1"` → connects to the "if" path
- `"condition-cond_2"` → connects to the "else if" path
- `"condition-cond_3"` → connects to the "else" path

**⚠️ Do NOT use `"true"` / `"false"` as sourceHandles** — those do not work. Always use `"condition-{conditionId}"`.

### Router Block

Source handles for edges: `"route-0"`, `"route-1"`, etc. based on route count.

### Integration Blocks (Selection)

| Type | Service | Key SubBlocks |
|------|---------|---------------|
| `slack` | Slack | `operation`, `credential`, `channel`, `text` |
| `gmail` / `gmail_v2` | Gmail | `operation`, `credential`, `to`, `subject`, `body` |
| `notion` | Notion | `operation`, `credential`, `databaseId` |
| `discord` | Discord | `operation`, `botToken`, `channelId`, `content` |
| `google_sheets` | Sheets | `operation`, `credential`, `spreadsheetId` |
| `airtable` | Airtable | `operation`, `credential`, `baseId`, `tableId` |
| `linear` | Linear | `operation`, `credential`, `teamId` |
| `jira` | Jira | `operation`, `credential`, `projectKey` |

---

## End-to-End Patterns

### Pattern 1: Create and Build an API Trigger → Agent → Response Workflow

```
Step 1: Create the workflow
create_workflow({ name: "Webhook Handler", workspaceId: "825eaf6a-..." })
→ returns { id: "wf_new" }

Step 2: Add blocks and edges (new workflows start empty — no default starter to remove)
add_blocks({
  workflowId: "wf_new",
  blocks: [
    { id: "trigger", type: "api_trigger", name: "API Trigger", position: { x: 100, y: 300 } },
    { id: "agent1", type: "agent", name: "Process", position: { x: 400, y: 300 } },
    { id: "resp", type: "response", name: "Response", position: { x: 700, y: 300 } }
  ],
  edges: [
    { id: "e1", source: "trigger", target: "agent1" },
    { id: "e2", source: "agent1", target: "resp" }
  ]
})

Step 3: Configure the agent
update_subblock({ workflowId: "wf_new", blockId: "agent1", subblockId: "systemPrompt", value: "Process the webhook payload and return a summary." })
update_subblock({ workflowId: "wf_new", blockId: "agent1", subblockId: "model", value: "gpt-4o" })
update_subblock({ workflowId: "wf_new", blockId: "agent1", subblockId: "apiKey", value: "sk-..." })
update_subblock({ workflowId: "wf_new", blockId: "agent1", subblockId: "messages", value: [{ "role": "user", "content": "Process this: <API Trigger.input>" }] })

Step 4: Configure the response (set json mode first, then data)
update_subblock({ workflowId: "wf_new", blockId: "resp", subblockId: "dataMode", value: "json" })
update_subblock({ workflowId: "wf_new", blockId: "resp", subblockId: "data", value: "<Process.content>" })
```

### Pattern 2: Execute and Monitor

```
Step 1: Execute the workflow
execute_workflow({
  workflowId: "wf_new",
  input: { message: "Test payload" },
  triggerType: "api"
})
→ returns execution result

Step 2: Check execution logs
get_execution_logs({
  workspaceId: "825eaf6a-...",
  workflowId: "wf_new",
  details: "full",
  includeTraceSpans: true,
  includeFinalOutput: true,
  limit: 5
})
→ returns logs with per-block traces, costs, outputs

Step 3: Get detail for a specific execution
get_execution_log_detail({ logId: "log_id_from_step_2" })
→ returns full trace with block-by-block execution data
```

### Pattern 3: Debug a Failed Execution

```
Step 1: Find error logs
get_execution_logs({
  workspaceId: "ws_id",
  workflowId: "wf_abc",
  level: "error",
  details: "full",
  includeTraceSpans: true,
  limit: 5
})

Step 2: Examine the specific failure
get_execution_log_detail({ logId: "failed_log_id" })
→ Look at trace spans to find which block failed and why

Step 3: Fix the block configuration
update_subblock({ workflowId: "wf_abc", blockId: "failing_block_id", subblockId: "...", value: "..." })

Step 4: Re-execute to verify
execute_workflow({ workflowId: "wf_abc", input: { ... } })
```

### Pattern 4: Conditional Branching

```
Step 1: Add condition block, configure conditions, and connect with correct sourceHandles
add_blocks({
  workflowId: "wf_abc",
  blocks: [
    { id: "cond", type: "condition", name: "Check", position: { x: 400, y: 300 } },
    { id: "yes", type: "agent", name: "Yes Path", position: { x: 700, y: 200 } },
    { id: "no", type: "agent", name: "No Path", position: { x: 700, y: 400 } }
  ],
  edges: [
    { id: "e1", source: "trigger_id", target: "cond" },
    { id: "e2", source: "cond", target: "yes", sourceHandle: "condition-is_high" },
    { id: "e3", source: "cond", target: "no", sourceHandle: "condition-fallback" }
  ]
})

Step 2: Configure conditions — each condition needs an id matching its edge sourceHandle
update_subblock({
  workflowId: "wf_abc",
  blockId: "cond",
  subblockId: "conditions",
  value: [
    { "id": "is_high", "title": "if", "value": "<PreviousBlock.result.priority> === 'high'" },
    { "id": "fallback", "title": "else", "value": "" }
  ]
})
```

**Important:** The condition `id` must match the edge `sourceHandle` suffix after `"condition-"`. Example: condition `id: "is_high"` → edge `sourceHandle: "condition-is_high"`.

---

## Block Positioning Conventions

| Convention | Value |
|-----------|-------|
| Horizontal spacing | 250–300px between blocks |
| Vertical spacing | 100–150px for branches |
| Trigger blocks | x: 100 (leftmost) |
| Processing blocks | x: 400–700 (middle) |
| Response blocks | x: 900+ (rightmost) |
| Starting y position | ~300 (centered on canvas) |

---

## Best Practices

### Building Workflows
- New workflows start empty — no default starter block to remove
- Use `add_blocks` with edges array to create blocks and connections in one call
- Let the system auto-generate block IDs unless you need to reference them in the same call
- After adding blocks, configure them with `update_subblock` — blocks start with no subBlock values

### Configuring Blocks
- SubBlock IDs must be known from this guide — `get_block` only shows subBlocks after they've been set
- Each `update_subblock` call updates one subBlock — batch multiple calls for efficiency
- The `model` subBlock on agent blocks uses format like `gpt-4o`, `claude-sonnet-4-20250514`, `gemini-2.0-flash`
- Agent blocks **require** `apiKey` and `model` to be set before execution (runtime validation — fails when block runs, not pre-flight)

### Executing and Monitoring
- `useDraftState: true` (default) means no deployment needed — execute the current draft directly
- Always check logs after execution to verify success
- Use `level: "error"` filter to quickly find failures
- Use `includeTraceSpans: true` to see per-block execution times and costs

### State Management
- Prefer targeted operations (`add_blocks`, `update_subblock`) over `replace_workflow_state`
- Only use `replace_workflow_state` for complete workflow restructuring
- All operations broadcast real-time updates to the UI

---

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| "No start block found" | Wrong trigger type for `execute_workflow` | Use `api_trigger` with `triggerType: "api"`, `generic_webhook` with `triggerType: "webhook"` |
| "Block not found" | Block was deleted or ID is wrong | Call `get_workflow` to verify current block IDs |
| "Invalid block type" | Misspelled type name | Check the Block Types Reference table above |
| "Edge already exists" | Duplicate source→target connection | Check existing edges with `get_workflow` first |
| Execution returns no output | Missing response block or broken edge chain | Verify all blocks are connected; set `dataMode` to `"json"` on response block |
| "missing required fields: API Key" | Agent block missing API key | Set `apiKey` and `model` subBlocks — both required (validated at runtime when block executes) |
| Subblock update has no effect | Wrong `subblockId` | SubBlock IDs must be known from this guide (not discoverable via `get_block` on fresh blocks) |
| Logs show no results | Wrong `workspaceId` or time range | Verify workspaceId; try without date filters first |
| Condition never matches | Wrong sourceHandle format | Use `"condition-{conditionId}"` not `"true"` / `"false"` |
| `inputData is not defined` | Wrong variable in function code | Use `<BlockName.field>` tag syntax for block references (`params` is always `{}` for regular function blocks) |
| Response block returns `{}` | Default `structured` mode ignores `data` subblock | Set `dataMode` to `"json"` before setting `data` |
| Function output not accessible | Wrong field name in tag | Function output uses `{ result: ..., stdout: "" }` — reference via `<FnName.result>` |

### Common Mistakes

1. **Forgetting to connect blocks** — blocks without edges won't execute
2. **Using block ID instead of display name in tags** — `<Agent 1.content>` uses the display name
3. **Not setting API keys** — agent blocks need `apiKey` subBlock configured — **hard requirement**
4. **Missing trigger block** — every workflow needs exactly one trigger
5. **Wrong sourceHandle on conditions** — use `"condition-{conditionId}"` format, NOT `"true"` / `"false"`
6. **Wrong trigger type** — `api_trigger` for API execution, `generic_webhook` for webhook execution
7. **Response block in structured mode** — set `dataMode` to `"json"` for tag-based responses
8. **Using `inputData` or `params` for block data in function blocks** — `params` is always `{}` for regular function blocks; use tag syntax `<BlockName.field>` instead
9. **Referencing function output as `.output`** — the correct field is `.result` (e.g., `<MyFunc.result>`)

---

## Quick Reference

### Minimum Viable Workflow

```
create_workflow → add_blocks (trigger + agent + response with edges) → update_subblock (model, apiKey, systemPrompt) → execute_workflow
```

### Tag Syntax

```
<BlockName.field>           Block output reference
<variable.name>             Variable reference
{{variable.name}}           Template variable in text
```

### Trigger Types for execute_workflow

`api` | `manual` | `schedule` | `chat` | `webhook` | `mcp` | `a2a`
