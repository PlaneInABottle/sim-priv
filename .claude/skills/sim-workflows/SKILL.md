---
name: sim-workflows
description: Use when building or modifying Sim workflows programmatically via MCP tools - adding/removing blocks, connecting edges, managing workflow state, importing/exporting workflows, or automating workflow creation. Provides comprehensive guide for all sim-mcp operations including block types, API operations, variables, subflows, templates, and best practices.
license: Complete terms in LICENSE.txt
---

# AI-Native Workflow Management

Autonomous guide for creating, building, executing, and monitoring Sim Studio workflows via the 21 sim-mcp tools. All operations update the UI in real-time.

> **Reference docs:** [MCP Tools Reference](references/mcp-tools-reference.md) · [Block Types](references/block-types.md) · [Troubleshooting](references/troubleshooting.md) · [Workflow Templates](examples/workflow-templates.json)

### When to Read References

**Read these when you need:**
- **Detailed tool parameters** → [MCP Tools Reference](references/mcp-tools-reference.md) — full parameter tables for all 21 tools
- **Subblock configurations** → [Block Types](references/block-types.md) — subblock IDs, formats, and examples for all block types
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
- **`add_blocks`**`({ workflowId, blocks: [{ type, name, position: {x,y} }], edges? })` — blocks start empty; configure with `update_subblock`
- **`add_edge`**`({ workflowId, source, target, sourceHandle?, targetHandle? })`
- **`add_variable`**`({ workflowId, name, type, value })` — reference as `<variable.name>`

### Configuration

- **`update_subblock`**`({ workflowId, blockId, subblockId, value })` — primary block configuration tool
- **`update_block_name`**`({ workflowId, blockId, name })`
- **`toggle_block_enabled`**`({ workflowId, blockId, enabled })`

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

**Two ways to create blocks with edges (both work):**
1. Atomic: `add_blocks({ blocks: [...], edges: [...] })` — creates everything in one call
2. Sequential: `add_blocks({ blocks: [...] })` then `add_edge(...)` — fine for existing blocks

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
<API Trigger.input>        — Full trigger input object
<Function 1.result>        — Function return value (always .result, not .output)
```

**Output fields by block type:**

| Block Type | Output Fields |
|-----------|--------------|
| `agent` | `.content` (response text) |
| `function` | `.result` (return value), `.stdout` (console output) |
| `api_trigger` | `.input` (full input), plus spread fields from inputFormat, optional `.files` |
| `api` | `.data` (response body), `.status`, `.headers` |
| `condition` | `.conditionResult` (boolean), `.selectedPath`, `.selectedOption`; spreads source output |
| `response` | `.data`, `.status`, `.headers` |

**Rules:**
- Case-sensitive; spaces work in agent/response fields but **not** in function block code
- In function code, tags become safe variable references (not inline strings) — block names must use only `[a-zA-Z0-9_.]`
- Supports dot notation for nested fields: `<Agent.content.choices[0]>`

### Workflow Variables

```
<variable.myVar>           — In block tag references
{{variable.myVar}}         — In template text fields
```

---

## Block Types & Configuration

### Trigger Blocks (exactly one required per workflow)

| Type | Name | Key SubBlocks |
|------|------|---------------|
| `api_trigger` | API Trigger | `inputFormat` |
| `generic_webhook` | Webhook | (dynamic from payload) |
| `chat_trigger` | Chat | (none — outputs: `input`, `conversationId`, `files`) |
| `schedule` | Schedule | `scheduleType`, `cronExpression`, `timezone` |
| `starter` | Starter | `startWorkflow` |
| `start_trigger` | Start | `inputFormat` |

**⚠️ Trigger / execute_workflow compatibility:**
- `triggerType: "api"` → requires `api_trigger` (NOT `generic_webhook`)
- `triggerType: "webhook"` → requires `generic_webhook`
- `triggerType: "chat"` → requires `chat_trigger`
- `triggerType: "manual"` → works with most trigger types
- Wrong match returns: `"No start block found. Add a start block to this workflow."`

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
const message = <API_Trigger.message>;  // becomes a variable holding the value
return { processed: true, data: message };
```

Output: `{ result: <returnValue>, stdout: "" }` → reference as `<FnName.result>`

### Condition Block

SubBlocks: `conditions`

```json
[
  { "id": "is_high", "title": "if", "value": "<Block.field> === 'high'" },
  { "id": "fallback", "title": "else", "value": "" }
]
```

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

## End-to-End Pattern: API Trigger → Agent → Response

```
Step 1: Create the workflow
create_workflow({ name: "Webhook Handler", workspaceId: "825eaf6a-..." })
→ returns { id: "wf_new" }

Step 2: Add blocks and edges (new workflows start empty)
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
update_subblock({ ..., blockId: "agent1", subblockId: "systemPrompt", value: "Process the payload." })
update_subblock({ ..., blockId: "agent1", subblockId: "model", value: "gpt-4o" })
update_subblock({ ..., blockId: "agent1", subblockId: "apiKey", value: "sk-..." })
update_subblock({ ..., blockId: "agent1", subblockId: "messages", value: [{ "role": "user", "content": "Process: <API Trigger.input>" }] })

Step 4: Configure response (json mode first, then data)
update_subblock({ ..., blockId: "resp", subblockId: "dataMode", value: "json" })
update_subblock({ ..., blockId: "resp", subblockId: "data", value: "<Process.content>" })

Step 5: Execute
execute_workflow({ workflowId: "wf_new", input: { message: "Test" }, triggerType: "api" })
```

### Conditional Branching Pattern

```
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

update_subblock({ ..., blockId: "cond", subblockId: "conditions", value: [
  { "id": "is_high", "title": "if", "value": "<PreviousBlock.result.priority> === 'high'" },
  { "id": "fallback", "title": "else", "value": "" }
]})
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
| Wrong trigger type | `api_trigger` for `triggerType: "api"`, `generic_webhook` for `"webhook"` |
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
