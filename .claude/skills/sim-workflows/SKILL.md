---
name: sim-workflows
description: Use when building or modifying Sim workflows programmatically via MCP tools - adding/removing blocks, connecting edges, managing workflow state, importing/exporting workflows, or automating workflow creation. Provides comprehensive guide for all sim-mcp operations including block types, API operations, variables, subflows, templates, and best practices.
license: Complete terms in LICENSE.txt
---

# Sim Workflows

This skill provides guidance for working with Sim workflows programmatically using the sim-mcp MCP server tools.

## What is Sim?

Sim is a visual workflow builder for creating AI agent workflows. Users design workflows on a canvas by connecting blocks (agents, tools, conditions, loops, etc.) with edges that define data flow and execution order.

## sim-mcp Overview

The **sim-mcp** MCP server provides tools to programmatically interact with Sim workflows. It enables:
- Listing, getting, deleting, importing, and exporting workflows
- Adding and removing blocks (agents, tools, conditions, etc.)
- Creating and removing edges (connections between blocks)
- Managing workflow variables and subflows
- Updating block properties and positions
- Replacing entire workflow states

## Available MCP Tools

### Workflow Management

**`list_workflows`** - List all workflows with optional filtering
- Parameters: `workspaceId?`, `limit?`, `offset?`
- Returns: Array of workflows with id, name, folderId, workspaceId

**`get_workflow`** - Get full workflow details including blocks, edges, state
- Parameters: `workflowId` (required)
- Returns: Complete workflow object with blocks, edges, variables, loops, parallels

**`delete_workflow`** - Permanently delete a workflow
- Parameters: `workflowId` (required)
- Warning: This cannot be undone

**`export_workflow`** - Export workflow as JSON for backup or sharing
- Parameters: `workflowId` (required)
- Returns: Complete workflow state as JSON
- Use case: Backup, version control, sharing, migration

**`import_workflow`** - Import workflow from JSON to create new workflow
- Parameters: `workspaceId` (required), `workflow` (required), `name?`, `folderId?`
- Use case: Restore backups, clone workflows, import templates

### Block Operations

**`add_blocks`** - Add one or more blocks to a workflow
- Parameters: 
  - `workflowId` (required)
  - `blocks` (required): Array of block objects with `type`, `name`, `position`, `data?`, `enabled?`, `id?`
  - `edges?`: Optional array of edges to create with the blocks
- Block types: `agent`, `api`, `condition`, `router`, `loop`, `parallel`, `webhook`, `api_trigger`, etc.
- Returns: Operation result with `success`, `operationId`, `timestamp`

**`remove_blocks`** - Remove one or more blocks from a workflow
- Parameters: `workflowId` (required), `blockIds` (required): Array of block IDs
- Note: Automatically removes connected edges

**`update_block_name`** - Update a block's display name
- Parameters: `workflowId` (required), `blockId` (required), `name` (required)

**`toggle_block_enabled`** - Enable or disable a block
- Parameters: `workflowId` (required), `blockId` (required), `enabled` (required: boolean)
- Disabled blocks are skipped during execution

**`update_subblock`** - Update a subblock value within a block
- Parameters: `workflowId`, `blockId`, `subblockId`, `value`
- Use case: Update configuration values within block settings

### Edge Operations

**`add_edge`** - Connect two blocks with an edge
- Parameters:
  - `workflowId` (required)
  - `source` (required): Source block ID
  - `target` (required): Target block ID
  - `sourceHandle?`: Optional source handle name
  - `targetHandle?`: Optional target handle name
  - `edgeId?`: Optional custom edge ID
- Edges define execution flow and data passing between blocks

**`remove_edge`** - Remove a connection between blocks
- Parameters: `workflowId` (required), `edgeId` (required)

### Variable Operations

**`add_variable`** - Add a workflow variable
- Parameters: `workflowId`, `name`, `type`, `value`, `id?`
- Types: `string`, `number`, `boolean`, `object`, `array`, `plain`
- Variables are accessible throughout workflow execution

**`remove_variable`** - Remove a workflow variable
- Parameters: `workflowId` (required), `variableId` (required)

### Subflow Operations

**`add_subflow`** - Add a loop or parallel subflow
- Parameters: `workflowId`, `id`, `type` (`loop` or `parallel`), `config?`
- Subflows enable iteration or parallel execution of blocks

**`update_subflow`** - Update subflow configuration
- Parameters: `workflowId`, `id`, `type?`, `config?`

**`remove_subflow`** - Remove a loop or parallel subflow
- Parameters: `workflowId` (required), `id` (required)

### Advanced Operations

**`replace_workflow_state`** - Replace entire workflow state
- Parameters: `workflowId` (required), `state` (required)
- Use with caution: Overwrites all blocks, edges, variables, and configuration
- Use case: Major refactoring, restoring from backup, applying templates

## Common Workflows

### Creating a Simple Agent Workflow

```javascript
// 1. Add an API trigger block
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "api_trigger",
    name: "API Trigger",
    position: { x: 100, y: 100 },
    data: {}
  }]
})

// 2. Add an agent block
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    id: "agent_1",
    type: "agent",
    name: "AI Assistant",
    position: { x: 300, y: 100 },
    data: {
      model: "gpt-4",
      systemPrompt: "You are a helpful assistant."
    }
  }]
})

// 3. Connect trigger to agent
add_edge({
  workflowId: "wf_123",
  source: "trigger_id",
  target: "agent_1"
})
```

### Cloning a Workflow

```javascript
// 1. Export existing workflow
const exported = export_workflow({ workflowId: "wf_original" })

// 2. Import as new workflow
import_workflow({
  workspaceId: "workspace_123",
  workflow: exported,
  name: "Copy of Original"
})
```

### Building Conditional Logic

```javascript
// Add condition block
add_blocks({
  workflowId: "wf_123",
  blocks: [{
    type: "condition",
    name: "Check Status",
    position: { x: 400, y: 100 },
    data: {
      condition: "{{input.status}} === 'success'"
    }
  }]
})

// Add blocks for true/false paths
add_blocks({
  workflowId: "wf_123",
  blocks: [
    { type: "agent", name: "Success Handler", position: { x: 600, y: 50 } },
    { type: "agent", name: "Error Handler", position: { x: 600, y: 150 } }
  ],
  edges: [
    { source: "condition_id", target: "success_id", sourceHandle: "true" },
    { source: "condition_id", target: "error_id", sourceHandle: "false" }
  ]
})
```

## Best Practices

### Block Positioning
- Space blocks 200-300px apart horizontally for readability
- Use vertical spacing (50-100px) for branching logic
- Keep trigger blocks on the left, response blocks on the right

### Block IDs
- Let the system auto-generate IDs unless you need specific references
- Use descriptive prefixes when providing custom IDs: `agent_`, `condition_`, `loop_`

### Batch Operations
- Use `add_blocks` with edges array to add multiple blocks and connections in one call
- More efficient than individual operations for complex workflows

### Error Handling
- Always check operation responses for `success: true`
- Handle cases where blocks might not exist (removed by user)
- Use `get_workflow` before modifications to verify current state

### State Management
- Use `export_workflow` before major changes for backup
- Prefer targeted operations (`add_blocks`, `remove_blocks`) over `replace_workflow_state`
- Only use `replace_workflow_state` for complete refactoring or restoration

### Variables
- Define workflow variables for reusable values
- Use variable references in block configurations: `{{variables.apiKey}}`
- Keep sensitive data in variables, not hardcoded in blocks

## Block Types Reference

Common block types and their purposes:

- **`api_trigger`** - Starts workflow via API call, provides request data
- **`webhook`** - Sends HTTP requests to external services
- **`agent`** - AI agent with LLM, tools, and knowledge base access
- **`condition`** - Branching logic based on expressions
- **`router`** - Multi-way routing based on conditions
- **`loop`** - Iterate over arrays or repeat until condition
- **`parallel`** - Execute multiple paths simultaneously
- **`api`** - Make HTTP requests to external APIs
- **`response`** - Return data from workflow execution
- **`code`** - Execute custom JavaScript/TypeScript code

See `references/block-types.md` for complete block type documentation.

## Troubleshooting

**"Block not found"** - Block may have been deleted; call `get_workflow` to verify current state

**"Invalid block type"** - Check block type spelling and ensure it's supported

**"Edge already exists"** - Cannot create duplicate edges between same source/target handles

**"Circular dependency"** - Edges cannot create loops (trigger → agent → trigger)

**Import fails** - Ensure exported workflow JSON is complete and valid

## Additional Resources

- See `references/operations-api.md` for REST operations endpoint details
- See `examples/workflow-templates.json` for common workflow patterns
- Sim documentation: https://docs.sim.ai
