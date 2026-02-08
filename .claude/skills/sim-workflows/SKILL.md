---
name: sim-workflows
description: Use when building or modifying Sim workflows programmatically via MCP tools - adding/removing blocks, connecting edges, managing workflow state, importing/exporting workflows, or automating workflow creation. Provides comprehensive guide for all sim-mcp operations including block types, API operations, variables, subflows, templates, and best practices.
license: Complete terms in LICENSE.txt
---

# AI-Native Workflow Management

Autonomous guide for creating, building, executing, and monitoring Sim Studio workflows via the 21 sim-mcp tools. All operations update the UI in real-time.

> **Reference docs:** [MCP Tools Reference](references/mcp-tools-reference.md) · [Block Types](references/block-types.md) · [Function Patterns](references/function-block-patterns.md) · [API Patterns](references/api-block-patterns.md) · [Troubleshooting](references/troubleshooting.md) · [Workflow Templates](examples/workflow-templates.json)

### When to Read References

**Read these when you need:**
- **Detailed tool parameters** → [MCP Tools Reference](references/mcp-tools-reference.md) — full parameter tables for all 21 tools
- **Subblock configurations** → [Block Types](references/block-types.md) — subblock IDs, formats, and examples for all block types
- **Function block code** → [Function Patterns](references/function-block-patterns.md) — sandbox APIs, tag usage, common patterns, error handling
- **API block setup** → [API Patterns](references/api-block-patterns.md) — headers format, body handling, tag resolution, public test APIs
- **Extended debugging** → [Troubleshooting](references/troubleshooting.md) — execution patterns, debug workflows, common error fixes

**Start with SKILL.md** — it covers 80% of workflow operations. Only dive into references for specific details.

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

## Tool Quick Reference

> **Need parameter details?** See [MCP Tools Reference](references/mcp-tools-reference.md)

### Creation & Building

- **`create_workflow`**`({ name, workspaceId })` → `{ id, name }`
- **`add_blocks`**`({ workflowId, blocks: [{ type, name, position: {x,y} }] })` — blocks start empty; configure with `update_subblock`
- **`add_edge`**`({ workflowId, source, target, sourceHandle?, targetHandle? })` — always use separate calls to connect blocks
- **`add_variable`**`({ workflowId, name, type, value })` — reference as `<variable.name>`

### Configuration

- **`update_subblock`**`({ workflowId, blockId, subblockId, value })` — primary block configuration tool
- **`update_block_name`**`({ workflowId, blockId, name })`
- **`toggle_block_enabled`**`({ workflowId, blockId, enabled })`
- **`update_block_parent`**`({ workflowId, blockId, parentId })` — nest block inside loop/parallel container, or pass `null` to remove

### Execution & Monitoring

- **`execute_workflow`**`({ workflowId, input?, triggerType? })` — `useDraftState: true` (default) = no deployment needed
- **`get_execution_logs`**`({ workspaceId, workflowId?, level?, details?, includeTraceSpans? })`
- **`get_execution_log_detail`**`({ logId })` — full trace with cost breakdown

### Inspection & Removal

- **`list_workflows`**`({ workspaceId })` · **`get_workflow`**`({ workflowId, verbose: false })` · **`get_block`**`({ workflowId, blockId })`
- **`remove_blocks`**`({ workflowId, blockIds })` · **`remove_edge`**`({ workflowId, edgeId })` · **`remove_variable`**`({ workflowId, variableId })`

### Advanced

- **`replace_workflow_state`**`({ workflowId, state })` — full overwrite; prefer targeted ops
- **`update_subflow`**`({ workflowId, id, type, config })` — update existing loop/parallel
- **`list_custom_tools`**`({ workspaceId })` · **`upsert_custom_tools`**`({ workspaceId, tools })`

### Using MCP Tools Correctly

**Always provide required parameters:**
- Block IDs must be unique within a workflow
- For condition/router blocks: `sourceHandle` format is `"condition-{conditionId}"` or `"route-{routeId}"`
- Edge IDs should be unique and descriptive

**Block and edge creation workflow:**
1. Create blocks first: `add_blocks({ blocks: [...] })`
2. Connect them separately: `add_edge({ source, target, sourceHandle?, targetHandle? })`
3. Use multiple `add_edge` calls for each connection

**Critical for condition blocks:**
- Set conditions via `update_subblock` BEFORE adding edges
- sourceHandle must match condition IDs: `"condition-{conditionId}"`
- Example: condition ID `"my-if"` → sourceHandle `"condition-my-if"`

---

## Data Reference Syntax

### Block Output Tags

Reference outputs using the block's **display name** (not ID):

```
<Agent 1.content>          — Agent's text response
<Start.input>              — Full trigger input object
<Function 1.result>        — Function return value (always .result, not .output)
```

**Output fields by block type:**

| Block Type | Output Fields |
|-----------|--------------|
| `agent` | `.content` (response text) |
| `function` | `.result` (return value), `.stdout` (console output) |
| `start_trigger` | `.input` (full input), `.conversationId`, `.files`, plus spread fields from inputFormat |
| `api` | `.data` (response body), `.status`, `.headers` |
| `condition` | `.conditionResult` (boolean), `.selectedPath`, `.selectedOption`; spreads source output |
| `response` | `.data`, `.status`, `.headers` |

**Rules:**
- Case-sensitive; spaces work in agent/response fields but **not** in function block code
- In function code, tags become safe variable references (not inline strings) — block names must use only `[a-zA-Z0-9_.]`
- Supports dot notation for nested fields: `<Agent.content.choices[0]>`

### Workflow Variables

```
<variable.myVar>           — Workflow variables (use angle brackets everywhere)
{{ENV_VAR}}                — Environment variables only (double braces)
```

### Condition Block Context Object

Condition blocks evaluate JavaScript expressions using a special `context` object that is **auto-populated from the source block's output** (the block directly connected upstream). The source block's output fields are spread flat onto `context`.

**How it works:** The condition expression is wrapped as:
```javascript
const context = { /* source block output, spread flat */ };
return Boolean(yourExpression)
```

**`context` fields by source block type:**

| Source Block | `context` Fields | Example Expression |
|-------------|-----------------|-------------------|
| `function` | `context.result` (return value), `context.stdout` | `context.result.priority === 'high'` |
| `agent` | `context.content` (response text), `context.tokens`, `context.model` | `context.content.includes('urgent')` |
| `api` | `context.data` (response body), `context.status`, `context.headers` | `context.status === 200` |
| `start_trigger` | `context.input` (full input), `context.conversationId`, `context.files`, plus spread inputFormat fields | `context.input.priority === 'high'` |
| `condition` | Spreads its own source output (inherits all fields from upstream) | `context.result > 100` |

**Both syntaxes work in conditions:**
- **`context.field`** — references the immediate source block's output
- **`<BlockName.field>`** — tag syntax, resolved server-side before evaluation (can reference ANY upstream block, not just the immediate source)

```json
// Using context (source block output)
{ "value": "context.result.priority === 'high'" }

// Using tag syntax (any block by display name)
{ "value": "<Function 1.result.priority> === 'high'" }

// Combining both
{ "value": "context.status === 200 && <Start.input.retryEnabled> === true" }
```

> **⚠️ WRONG:** `<PreviousBlock.result.priority> === 'high'` — tags use display names only, not generic labels. Use the actual block name or `context.field`.

---

## Block Types & Configuration

### Trigger Blocks (exactly one required per workflow)

| Type | Name | Key SubBlocks | Use For |
|------|------|---------------|---------|
| `start_trigger` | Start | `inputFormat` | ✅ **Recommended** — unified entry point for API, manual, chat, MCP, A2A triggers |
| `generic_webhook` | Webhook | (dynamic from payload) | Receiving incoming webhooks from external services |
| `schedule` | Schedule | `scheduleType`, `cronExpression`, `timezone` | Scheduled/cron workflows |

> **⚠️ Legacy triggers (`api_trigger`, `chat_trigger`, `manual_trigger`, `input_trigger`, `starter`) are hidden from the toolbar and deprecated. Always use `start_trigger` instead.**

**⚠️ Trigger / execute_workflow compatibility:**
- `triggerType: "api"` → works with `start_trigger`
- `triggerType: "manual"` → works with `start_trigger`
- `triggerType: "chat"` → works with `start_trigger`
- `triggerType: "mcp"` → works with `start_trigger`
- `triggerType: "a2a"` → works with `start_trigger`
- `triggerType: "webhook"` → requires `generic_webhook`
- `triggerType: "schedule"` → requires `schedule`
- Wrong match returns: `"No start block found. Add a start block to this workflow."`

**Start block outputs:** `.input` (full input object), `.conversationId`, `.files`, plus any custom fields defined in `inputFormat`

### Agent Block

SubBlocks: `model`, `systemPrompt`, `messages`, `tools`, `responseFormat`, `temperature`, `maxTokens`, `apiKey`

**⚠️ REQUIRES `apiKey` and `model` before execution** — runtime error if missing.

Messages format: `[{ "role": "user", "content": "Text with <BlockName.field> tags" }]`

### Function Block

SubBlocks: `language`, `code`

Runtime environment:
- **`params`** — always `{}` (only populated for custom tool executions)
- **`<BlockName.field>`** — tag syntax (replaced with variable references before execution)
- **`console`**, **`fetch`** (sandboxed), **`environmentVariables`**

```javascript
const message = <Start.message>;  // becomes a variable holding the value
return { processed: true, data: message };
```

Output: `{ result: <returnValue>, stdout: "" }` → reference as `<FnName.result>`

### Condition Block

SubBlocks: `conditions`

```json
[
  { "id": "is_high", "title": "if", "value": "context.result.priority === 'high'" },
  { "id": "fallback", "title": "else", "value": "" }
]
```

**Expression syntax:** Use `context.field` to reference the source block's output (auto-populated), or `<BlockName.field>` tag syntax to reference any upstream block by display name. See [Condition Block Context Object](#condition-block-context-object) for full details.

**⚠️ Edge sourceHandles must be `"condition-{conditionId}"`.** Do NOT use `"true"` / `"false"`.

### Router Block

Source handles: `"route-0"`, `"route-1"`, etc. SubBlocks: `prompt`, `model`

### Response Block

SubBlocks: `data`, `dataMode`, `builderData`, `status`, `headers`

**⚠️ For programmatic use, set `dataMode` to `"json"` first**, then set `data`:
```
update_subblock(blockId, "dataMode", "json")
update_subblock(blockId, "data", '{"result": "<Agent.content>"}')
```

### Other Blocks

| Type | Key SubBlocks |
|------|---------------|
| `api` | `url`, `method`, `headers`, `body`, `params`, `timeout` |
| `slack` | `operation`, `credential`, `channel`, `text` |
| `gmail` / `gmail_v2` | `operation`, `credential`, `to`, `subject`, `body` |
| `notion` | `operation`, `credential`, `databaseId` |
| `discord` | `operation`, `botToken`, `channelId`, `content` |
| `google_sheets` | `operation`, `credential`, `spreadsheetId` |
| `airtable` | `operation`, `credential`, `baseId`, `tableId` |
| `linear` | `operation`, `credential`, `teamId` |
| `jira` | `operation`, `credential`, `projectKey` |

> **Need subblock IDs?** See [Block Types](references/block-types.md)

---

## End-to-End Pattern: Start → Agent → Response

```
Step 1: Create the workflow
create_workflow({ name: "My Workflow", workspaceId: "825eaf6a-..." })
→ returns { id: "wf_new" }

Step 2: Add blocks (new workflows start empty)
add_blocks({
  workflowId: "wf_new",
  blocks: [
    { id: "trigger", type: "start_trigger", name: "Start", position: { x: 100, y: 300 } },
    { id: "agent1", type: "agent", name: "Process", position: { x: 400, y: 300 } },
    { id: "resp", type: "response", name: "Response", position: { x: 700, y: 300 } }
  ]
})

Step 2b: Connect blocks with edges
add_edge({ workflowId: "wf_new", source: "trigger", target: "agent1" })
add_edge({ workflowId: "wf_new", source: "agent1", target: "resp" })

Step 3: Configure the agent
update_subblock({ ..., blockId: "agent1", subblockId: "systemPrompt", value: "Process the payload." })
update_subblock({ ..., blockId: "agent1", subblockId: "model", value: "gpt-4o" })
update_subblock({ ..., blockId: "agent1", subblockId: "apiKey", value: "sk-..." })
update_subblock({ ..., blockId: "agent1", subblockId: "messages", value: [{ "role": "user", "content": "Process: <Start.input>" }] })

Step 4: Configure response (json mode first, then data)
update_subblock({ ..., blockId: "resp", subblockId: "dataMode", value: "json" })
update_subblock({ ..., blockId: "resp", subblockId: "data", value: "<Process.content>" })

Step 5: Execute
execute_workflow({ workflowId: "wf_new", input: { message: "Test" }, triggerType: "api" })
```

### Conditional Branching Pattern

```
// Step 1: Add blocks
add_blocks({
  workflowId: "wf_abc",
  blocks: [
    { id: "cond", type: "condition", name: "Check", position: { x: 400, y: 300 } },
    { id: "yes", type: "agent", name: "Yes Path", position: { x: 700, y: 200 } },
    { id: "no", type: "agent", name: "No Path", position: { x: 700, y: 400 } }
  ]
})

// Step 2: Configure conditions (BEFORE adding edges)
update_subblock({ ..., blockId: "cond", subblockId: "conditions", value: [
  { "id": "is_high", "title": "if", "value": "context.result.priority === 'high'" },
  { "id": "fallback", "title": "else", "value": "" }
]})

// Step 3: Add edges (after conditions are configured)
add_edge({ workflowId: "wf_abc", source: "trigger_id", target: "cond" })
add_edge({ workflowId: "wf_abc", source: "cond", target: "yes", sourceHandle: "condition-is_high" })
add_edge({ workflowId: "wf_abc", source: "cond", target: "no", sourceHandle: "condition-fallback" })
```

**Key:** Condition `id` must match edge `sourceHandle` suffix after `"condition-"`.

> More patterns: [references/troubleshooting.md](references/troubleshooting.md) (Execute & Monitor, Debug Failures)

---

## Debugging Workflows

**When execution fails or blocks don't execute:**

1. **Inspect full workflow state:**
   ```javascript
   get_workflow({ workflowId: "...", verbose: true })
   ```
   Check:
   - Are all blocks present with correct types?
   - Do edges exist with correct source/target/sourceHandle?
   - Are subBlocks properly configured?

2. **Check execution logs:**
   ```javascript
   get_execution_logs({ 
     workflowId: "...", 
     workspaceId: "...",
     details: "full",
     includeTraceSpans: true 
   })
   ```
   Look for:
   - Which blocks executed successfully?
   - Where did execution stop?
   - Any error messages in trace spans?

3. **Common execution issues:**
   - Missing edges: Block isolated, never receives execution flow
   - Wrong sourceHandle: Condition/router can't route to target block
   - Missing subBlocks: Block fails validation (e.g., agent without apiKey)
   - Incorrect tag syntax: Function blocks can't resolve references

---

## Best Practices

- **New workflows start empty** — no default starter to remove
- **Use `add_blocks` with edges** to create blocks and connections in one call
- **SubBlock IDs come from this guide** — `get_block` only shows subBlocks after they've been set
- **Agent blocks require `apiKey` and `model`** — runtime validation, fails when block runs
- **`useDraftState: true`** (default) — no deployment needed for testing
- **Prefer `get_workflow(verbose: false)` + `get_block`** over `verbose: true`
- **Prefer targeted operations** over `replace_workflow_state`
- **Debug systematically**: Use `get_workflow(verbose: true)` to inspect state before assuming bugs
- **Use `toggle_block_enabled` for safe testing** — disable blocks like email/Slack senders during development to test workflow logic without side effects

### Disabling Blocks for Safe Testing

Use `toggle_block_enabled` to skip blocks during execution without removing them. Disabled blocks preserve their configuration and connections but are skipped by the executor.

**Common use cases:**
- **Test without side effects**: Disable email, Slack, or webhook blocks to test workflow logic without sending real messages
- **A/B test paths**: Disable one branch to force execution through another
- **Isolate failures**: Disable downstream blocks to test upstream logic in isolation
- **Staging workflows**: Disable production integrations while developing

**Pattern: Disable → Test → Re-enable**

```
// Step 1: Disable the Slack notification block
toggle_block_enabled({ workflowId: "wf_abc", blockId: "slack_notify", enabled: false })

// Step 2: Execute the workflow — Slack block is skipped
execute_workflow({ workflowId: "wf_abc", input: { message: "Test" }, triggerType: "api" })

// Step 3: Verify via logs that upstream blocks ran correctly
get_execution_logs({ workspaceId: "ws_123", workflowId: "wf_abc", details: "full", includeTraceSpans: true })

// Step 4: Re-enable when ready for production
toggle_block_enabled({ workflowId: "wf_abc", blockId: "slack_notify", enabled: true })
```

**Checking block enabled state:**
```
// Use get_block to verify current enabled state
get_block({ workflowId: "wf_abc", blockId: "slack_notify" })
// → { block: { id: "slack_notify", enabled: false, ... } }

// Or use get_workflow (verbose: false) to see all blocks' enabled status
get_workflow({ workflowId: "wf_abc", verbose: false })
```

**Important:** `toggle_block_enabled` emits a Socket.io broadcast (`broadcastSent: true`), so the UI updates in real-time when blocks are toggled programmatically.

### Nesting Blocks in Loop/Parallel Containers

Use `update_block_parent` to programmatically nest blocks inside loop or parallel containers. This sets the block's `parentId` so it appears visually inside the container on the canvas.

```
// Step 1: Create a loop block and a regular block
add_blocks({
  workflowId: "wf_abc",
  blocks: [
    { id: "loop1", type: "loop", name: "Process Items", position: { x: 400, y: 300 } },
    { id: "agent1", type: "agent", name: "Process Agent", position: { x: 450, y: 350 } }
  ]
})

// Step 2: Nest agent inside loop
update_block_parent({ workflowId: "wf_abc", blockId: "agent1", parentId: "loop1" })

// Step 3: Remove nesting (make standalone again)
update_block_parent({ workflowId: "wf_abc", blockId: "agent1", parentId: null })
```

**Works with both container types:**
- `parentId: "loop-block-id"` — nest inside a loop
- `parentId: "parallel-block-id"` — nest inside a parallel
- `parentId: null` — remove from container (standalone)

### Block Positioning

| Position | x value |
|----------|---------|
| Trigger (leftmost) | 100 |
| Processing (middle) | 400–700 |
| Response (rightmost) | 900+ |
| Vertical spacing | 100–150px for branches |
| Starting y | ~300 (centered) |

---

## Critical Warnings

> Full troubleshooting: [references/troubleshooting.md](references/troubleshooting.md)

| ⚠️ Mistake | Fix |
|-----------|-----|
| Wrong trigger type | `start_trigger` for `triggerType: "api"/"manual"/"chat"`, `generic_webhook` for `"webhook"`, `schedule` for `"schedule"` |
| Block ID in tags | Use **display name**: `<Agent 1.content>` not `<block_id.content>` |
| Missing API key | Set both `apiKey` and `model` on agent blocks |
| Wrong condition handles | Use `"condition-{conditionId}"` NOT `"true"`/`"false"` |
| Response returns `{}` | Set `dataMode` to `"json"` before setting `data` |
| `inputData is not defined` | Use `<BlockName.field>` tag syntax; `params` is always `{}` |
| Function `.output` | Use `.result` — output is `{ result: ..., stdout: "" }` |

---

## Quick Reference

### Minimum Viable Workflow

```
create_workflow → add_blocks (trigger + agent + response) → add_edge (connect blocks) → update_subblock (model, apiKey, systemPrompt) → execute_workflow
```

### Tag Syntax

```
<BlockName.field>           Block output reference
<variable.name>             Workflow variable reference
{{ENV_VAR}}                 Environment variable
context.field               Condition block context (source output)
```

### Trigger Types for execute_workflow

`api` | `manual` | `schedule` | `chat` | `webhook` | `mcp` | `a2a`

---

## Tag Syntax Edge Cases & Troubleshooting

### Nested Property Access
Tags support dot notation for nested properties:
```
<Function 1.result.user.name>     — Nested object access
<API Call.data.items[0].id>       — Array index access
```
If a nested path is `undefined`, the tag resolves to `undefined` (not an error).

### Null / Undefined References
- If a referenced block hasn't executed yet, the tag resolves to `undefined`
- If a field doesn't exist on the output, the tag resolves to `undefined`
- Use condition checks: `context.result !== undefined && context.result.field === 'value'`

### Tags in Function Block Code
Tags in function code are replaced with safe variable names before execution:
```javascript
// Written as:
const data = <My API.data>;

// Becomes (internally):
const __tag_my_api_0data = /* actual value */;
const data = __tag_my_api_0data;
```
**⚠️ Block names with spaces:** Work in tag syntax but the internal variable name sanitization handles them. However, for clarity and reliability in function code, prefer block names without spaces (e.g., "MyAPI" instead of "My API").

### Tags vs Context in Conditions
- **`context.field`** — references the immediate source block only; auto-populated
- **`<BlockName.field>`** — can reference ANY upstream block by display name; resolved server-side
- Both can be used in the same expression: `context.status === 200 && <Start.input.mode> === 'strict'`
