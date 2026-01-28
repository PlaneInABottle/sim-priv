# sim-mcp Operations Endpoint Refactor Implementation Plan

## Executive Summary

- **Objective:** Refactor sim-mcp to use the new operations endpoint (`POST /api/v1/admin/workflows/{id}/operations`) for all block and edge mutations, add import/export tools, and remove broken tools
- **Non-goals:** Adding new block types, changing workflow listing/get/delete behavior, modifying execute_workflow
- **Constraints:** Maintain backward compatibility for 4 working tools, use existing patterns, YAGNI/KISS/DRY principles
- **Proposed approach:** Replace 7 broken tools with 9 operation-based tools + 2 import/export tools, add generic operations client method
- **Estimated time:** 5-6 days
- **Total phases:** 7
- **Total commits:** 18-20

## Current State (Evidence)

### Working Tools (4) - KEEP UNCHANGED
| Tool | File | Endpoint |
|------|------|----------|
| `list_workflows` | `src/tools/workflow/list.ts` | `GET /api/v1/admin/workflows` |
| `get_workflow` | `src/tools/workflow/get.ts` | `GET /api/v1/admin/workflows/{id}` |
| `delete_workflow` | `src/tools/workflow/delete.ts` | `DELETE /api/v1/admin/workflows/{id}` |
| `execute_workflow` | `src/tools/workflow/execute.ts` | `POST /api/v1/admin/workflows/{id}/execute` |

### Broken Tools (7) - TO BE REMOVED
| Tool | File | Issue |
|------|------|-------|
| `create_workflow` | `src/tools/workflow/create.ts` | `POST /workflows` doesn't exist |
| `update_workflow` | `src/tools/workflow/update.ts` | `PUT /workflows/{id}` doesn't exist |
| `add_block` | `src/tools/blocks/add.ts` | `POST /workflows/{id}/blocks` doesn't exist |
| `update_block` | `src/tools/blocks/update.ts` | `PATCH /workflows/{id}/blocks/{id}` doesn't exist |
| `remove_block` | `src/tools/blocks/remove.ts` | `DELETE /workflows/{id}/blocks/{id}` doesn't exist |
| `add_edge` | `src/tools/edges/add.ts` | `POST /workflows/{id}/edges` doesn't exist |
| `remove_edge` | `src/tools/edges/remove.ts` | `DELETE /workflows/{id}/edges/{id}` doesn't exist |

### Available Backend Endpoints
| Endpoint | Purpose | Status |
|----------|---------|--------|
| `GET /api/v1/admin/workflows` | List workflows | ✅ Working |
| `GET /api/v1/admin/workflows/{id}` | Get workflow with state | ✅ Working |
| `DELETE /api/v1/admin/workflows/{id}` | Delete workflow | ✅ Working |
| `POST /api/v1/admin/workflows/{id}/execute` | Execute workflow | ✅ Working |
| `POST /api/v1/admin/workflows/{id}/operations` | Workflow operations | ✅ NEW - Use this! |
| `GET /api/v1/admin/workflows/{id}/export` | Export workflow | ✅ Available |
| `POST /api/v1/admin/workflows/import` | Import workflow | ✅ Available |

### Operations Endpoint Schema
```typescript
// POST /api/v1/admin/workflows/{id}/operations
{
  operation: string,      // e.g., "batch-add-blocks", "add", "remove"
  target: string,         // e.g., "blocks", "block", "edge", "workflow"
  payload: any,           // Operation-specific data
  timestamp?: number,     // Optional (defaults to Date.now())
  broadcast?: boolean     // Optional (defaults to true)
}

// Response
{
  success: boolean,
  operationId: string,
  timestamp: number,
  broadcastSent: boolean
}
```

### Supported Operations
| Target | Operation | Payload |
|--------|-----------|---------|
| `blocks` | `batch-add-blocks` | `{ blocks: [], edges?: [], loops?, parallels? }` |
| `blocks` | `batch-remove-blocks` | `{ ids: string[] }` |
| `blocks` | `batch-update-positions` | `{ updates: [{ id, position }] }` |
| `block` | `update-position` | `{ id, position: { x, y }, commit? }` |
| `block` | `update-name` | `{ id, name }` |
| `block` | `toggle-enabled` | `{ id, enabled }` |
| `edge` | `add` | `{ id, source, target, sourceHandle, targetHandle }` |
| `edge` | `remove` | `{ id }` |
| `workflow` | `replace-state` | `{ state: WorkflowState }` |

### Test Structure
- `tests/unit/tools/workflow.test.ts` (456 lines, 27 tests)
- `tests/unit/tools/blocks.test.ts` (449 lines, 22 tests)  
- `tests/unit/tools/edges.test.ts` (410 lines, 21 tests)
- `tests/mocks/sim-api.ts` (344 lines, mock factory)

## Requirements

### Functional Requirements
1. Remove all 7 broken tools
2. Add 9 new operation-based tools for block/edge mutations
3. Add 2 import/export tools
4. Keep 4 working tools unchanged
5. Add generic `workflowOperation()` method to SimApiClient
6. Add import/export methods to SimApiClient

### Non-Functional Requirements
- Maintain existing test patterns
- Keep tool descriptions clear and LLM-friendly
- Error handling consistent with existing tools
- No breaking changes to working tools

### Acceptance Criteria
- All new tools callable via MCP
- All tests pass
- TypeScript builds without errors
- Import/export round-trip works correctly
- Operations correctly update workflow state

## Proposed Design

### New Tools (11 total replacing 7 broken)

#### Import/Export Tools (2)
| Tool | Description | Endpoint |
|------|-------------|----------|
| `export_workflow` | Export workflow as JSON for backup/sharing | `GET /workflows/{id}/export` |
| `import_workflow` | Import workflow JSON to create new workflow | `POST /workflows/import` |

#### Block Tools via Operations (4)
| Tool | Operation | Target | Description |
|------|-----------|--------|-------------|
| `add_blocks` | `batch-add-blocks` | `blocks` | Add one or more blocks with edges |
| `remove_blocks` | `batch-remove-blocks` | `blocks` | Remove one or more blocks |
| `update_block_position` | `update-position` | `block` | Update block position (x, y) |
| `update_block_name` | `update-name` | `block` | Update block display name |
| `toggle_block_enabled` | `toggle-enabled` | `block` | Enable/disable a block |

#### Edge Tools via Operations (2)
| Tool | Operation | Target | Description |
|------|-----------|--------|-------------|
| `add_edge` | `add` | `edge` | Connect two blocks |
| `remove_edge` | `remove` | `edge` | Remove connection between blocks |

#### Workflow State Tools (1)
| Tool | Operation | Target | Description |
|------|-----------|--------|-------------|
| `replace_workflow_state` | `replace-state` | `workflow` | Replace entire workflow state |

### Directory Structure
```
sim-mcp/src/
├── client/
│   ├── sim-api-client.ts    # Add: workflowOperation(), exportWorkflow(), importWorkflow()
│   └── types.ts             # Add: OperationRequest, OperationResponse, ExportPayload, ImportRequest
├── schemas/
│   ├── workflow.ts          # Unchanged
│   ├── block.ts             # Unchanged  
│   ├── edge.ts              # Unchanged
│   └── operations.ts        # NEW: Operation input/output schemas
├── tools/
│   ├── workflow/
│   │   ├── list.ts          # Unchanged
│   │   ├── get.ts           # Unchanged
│   │   ├── delete.ts        # Unchanged
│   │   ├── execute.ts       # Unchanged
│   │   ├── export.ts        # NEW
│   │   ├── import.ts        # NEW
│   │   ├── replace-state.ts # NEW
│   │   ├── create.ts        # DELETE
│   │   ├── update.ts        # DELETE
│   │   └── index.ts         # Update exports
│   ├── blocks/
│   │   ├── add-blocks.ts           # NEW (replaces add.ts)
│   │   ├── remove-blocks.ts        # NEW (replaces remove.ts)
│   │   ├── update-position.ts      # NEW (partial replacement of update.ts)
│   │   ├── update-name.ts          # NEW (partial replacement of update.ts)
│   │   ├── toggle-enabled.ts       # NEW (partial replacement of update.ts)
│   │   ├── add.ts                  # DELETE
│   │   ├── update.ts               # DELETE
│   │   ├── remove.ts               # DELETE
│   │   └── index.ts                # Update exports
│   ├── edges/
│   │   ├── add.ts           # REPLACE (use operations endpoint)
│   │   ├── remove.ts        # REPLACE (use operations endpoint)
│   │   └── index.ts         # Update exports
│   └── index.ts             # Update all exports
└── server.ts                # Update tool registration

sim-mcp/tests/
├── mocks/
│   └── sim-api.ts           # Add mock methods for new operations
└── unit/tools/
    ├── workflow.test.ts     # Add export/import/replace-state tests
    ├── blocks.test.ts       # Rewrite for new operation-based tools
    └── edges.test.ts        # Update for operation-based add/remove
```

### SimApiClient Method Signatures

```typescript
// New methods to add to SimApiClient

// Generic operation method
async workflowOperation(
  workflowId: string,
  operation: string,
  target: string,
  payload: Record<string, unknown>,
  options?: { broadcast?: boolean; timestamp?: number }
): Promise<OperationResponse>

// Export workflow
async exportWorkflow(workflowId: string): Promise<WorkflowExportPayload>

// Import workflow
async importWorkflow(request: ImportWorkflowRequest): Promise<ImportWorkflowResponse>
```

### Type Definitions

```typescript
// src/client/types.ts additions

export interface OperationRequest {
  operation: string;
  target: string;
  payload: Record<string, unknown>;
  timestamp?: number;
  broadcast?: boolean;
}

export interface OperationResponse {
  success: boolean;
  operationId: string;
  timestamp: number;
  broadcastSent: boolean;
}

export interface WorkflowExportPayload {
  version: string;
  exportedAt: string;
  workflow: {
    id: string;
    name: string;
    description?: string;
    color?: string;
    workspaceId: string;
    folderId?: string;
  };
  state: WorkflowState;
}

export interface ImportWorkflowRequest {
  workspaceId: string;
  folderId?: string;
  name?: string;
  workflow: WorkflowExportPayload;
}

export interface ImportWorkflowResponse {
  workflowId: string;
  name: string;
  success: boolean;
}
```

### Tool Input Schemas

```typescript
// schemas/operations.ts

// Export workflow
export const ExportWorkflowInputSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
});

// Import workflow
export const ImportWorkflowInputSchema = z.object({
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  folderId: z.string().optional(),
  name: z.string().optional(),
  workflow: z.any(), // Full export payload
});

// Add blocks
export const AddBlocksInputSchema = z.object({
  workflowId: z.string().min(1),
  blocks: z.array(z.object({
    id: z.string().optional(), // Auto-generate if not provided
    type: z.string().min(1),
    name: z.string().min(1),
    position: z.object({ x: z.number(), y: z.number() }),
    data: z.record(z.unknown()).optional(),
    subBlocks: z.record(z.unknown()).optional(),
    outputs: z.record(z.unknown()).optional(),
    enabled: z.boolean().optional().default(true),
  })),
  edges: z.array(z.object({
    source: z.string(),
    target: z.string(),
    sourceHandle: z.string().optional(),
    targetHandle: z.string().optional(),
  })).optional(),
});

// Remove blocks
export const RemoveBlocksInputSchema = z.object({
  workflowId: z.string().min(1),
  blockIds: z.array(z.string().min(1)).min(1),
});

// Update block position
export const UpdateBlockPositionInputSchema = z.object({
  workflowId: z.string().min(1),
  blockId: z.string().min(1),
  x: z.number(),
  y: z.number(),
});

// Update block name
export const UpdateBlockNameInputSchema = z.object({
  workflowId: z.string().min(1),
  blockId: z.string().min(1),
  name: z.string().min(1),
});

// Toggle block enabled
export const ToggleBlockEnabledInputSchema = z.object({
  workflowId: z.string().min(1),
  blockId: z.string().min(1),
  enabled: z.boolean(),
});

// Add edge
export const AddEdgeInputSchema = z.object({
  workflowId: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  sourceHandle: z.string().optional(),
  targetHandle: z.string().optional(),
});

// Remove edge
export const RemoveEdgeInputSchema = z.object({
  workflowId: z.string().min(1),
  edgeId: z.string().min(1),
});

// Replace workflow state
export const ReplaceWorkflowStateInputSchema = z.object({
  workflowId: z.string().min(1),
  state: z.any(), // Full workflow state object
});
```

## Implementation Plan (Phased)

### Phase 1: Add Client Infrastructure (Est. 0.5 days)

**Commits in this phase: 3**

#### Commit 1.1: Add operation types to client/types.ts
- **Steps:**
  1. Add `OperationRequest` interface
  2. Add `OperationResponse` interface
  3. Add `WorkflowExportPayload` interface
  4. Add `ImportWorkflowRequest` interface
  5. Add `ImportWorkflowResponse` interface
- **Files:** `src/client/types.ts`
- **New/modified lines:** ~40
- **Tests/validation:** TypeScript compiles
- **Value delivered:** Type safety for all new operations
- **Independently committable:** Yes
- **Dependencies:** None

#### Commit 1.2: Add workflowOperation() method to SimApiClient
- **Steps:**
  1. Add `workflowOperation()` method
  2. Handle operation request/response
  3. Map errors appropriately
- **Files:** `src/client/sim-api-client.ts`
- **New/modified lines:** ~30
- **Tests/validation:** Unit test with mock
- **Value delivered:** Generic operation method for all tools
- **Independently committable:** Yes
- **Dependencies:** Commit 1.1

#### Commit 1.3: Add import/export methods to SimApiClient
- **Steps:**
  1. Add `exportWorkflow()` method
  2. Add `importWorkflow()` method
- **Files:** `src/client/sim-api-client.ts`
- **New/modified lines:** ~25
- **Tests/validation:** Unit test with mock
- **Value delivered:** Import/export capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.1

### Phase 2: Add Operation Schemas (Est. 0.5 days)

**Commits in this phase: 1**

#### Commit 2.1: Create operations.ts schema file
- **Steps:**
  1. Create `src/schemas/operations.ts`
  2. Add all input schemas for new tools
  3. Export from `src/schemas/index.ts`
- **Files:** `src/schemas/operations.ts`, `src/schemas/index.ts`
- **New/modified lines:** ~100
- **Tests/validation:** TypeScript compiles, schemas validate correctly
- **Value delivered:** Input validation for all new tools
- **Independently committable:** Yes
- **Dependencies:** None

### Phase 3: Add Import/Export Tools (Est. 0.5 days)

**Commits in this phase: 2**

#### Commit 3.1: Add export_workflow tool
- **Steps:**
  1. Create `src/tools/workflow/export.ts`
  2. Implement tool function
  3. Add JSON Schema for MCP
  4. Update `src/tools/workflow/index.ts`
- **Files:** `src/tools/workflow/export.ts`, `src/tools/workflow/index.ts`
- **New/modified lines:** ~80
- **Tests/validation:** Tool callable, returns valid export
- **Value delivered:** Workflow backup capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.3

#### Commit 3.2: Add import_workflow tool
- **Steps:**
  1. Create `src/tools/workflow/import.ts`
  2. Implement tool function
  3. Add JSON Schema for MCP
  4. Update `src/tools/workflow/index.ts`
- **Files:** `src/tools/workflow/import.ts`, `src/tools/workflow/index.ts`
- **New/modified lines:** ~90
- **Tests/validation:** Tool callable, creates workflow
- **Value delivered:** Workflow restore/clone capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.3

### Phase 4: Add Block Operation Tools (Est. 1 day)

**Commits in this phase: 5**

#### Commit 4.1: Add add_blocks tool
- **Steps:**
  1. Create `src/tools/blocks/add-blocks.ts`
  2. Use `workflowOperation()` with `batch-add-blocks`
  3. Add JSON Schema for MCP
  4. Update `src/tools/blocks/index.ts`
- **Files:** `src/tools/blocks/add-blocks.ts`, `src/tools/blocks/index.ts`
- **New/modified lines:** ~100
- **Tests/validation:** Tool adds blocks to workflow
- **Value delivered:** Block creation capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2, 2.1

#### Commit 4.2: Add remove_blocks tool
- **Steps:**
  1. Create `src/tools/blocks/remove-blocks.ts`
  2. Use `workflowOperation()` with `batch-remove-blocks`
  3. Add JSON Schema for MCP
  4. Update `src/tools/blocks/index.ts`
- **Files:** `src/tools/blocks/remove-blocks.ts`, `src/tools/blocks/index.ts`
- **New/modified lines:** ~70
- **Tests/validation:** Tool removes blocks from workflow
- **Value delivered:** Block deletion capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2, 2.1

#### Commit 4.3: Add update_block_position tool
- **Steps:**
  1. Create `src/tools/blocks/update-position.ts`
  2. Use `workflowOperation()` with `update-position`
  3. Add JSON Schema for MCP
  4. Update `src/tools/blocks/index.ts`
- **Files:** `src/tools/blocks/update-position.ts`, `src/tools/blocks/index.ts`
- **New/modified lines:** ~70
- **Tests/validation:** Tool updates block position
- **Value delivered:** Block repositioning capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2, 2.1

#### Commit 4.4: Add update_block_name tool
- **Steps:**
  1. Create `src/tools/blocks/update-name.ts`
  2. Use `workflowOperation()` with `update-name`
  3. Add JSON Schema for MCP
  4. Update `src/tools/blocks/index.ts`
- **Files:** `src/tools/blocks/update-name.ts`, `src/tools/blocks/index.ts`
- **New/modified lines:** ~65
- **Tests/validation:** Tool updates block name
- **Value delivered:** Block renaming capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2, 2.1

#### Commit 4.5: Add toggle_block_enabled tool
- **Steps:**
  1. Create `src/tools/blocks/toggle-enabled.ts`
  2. Use `workflowOperation()` with `toggle-enabled`
  3. Add JSON Schema for MCP
  4. Update `src/tools/blocks/index.ts`
- **Files:** `src/tools/blocks/toggle-enabled.ts`, `src/tools/blocks/index.ts`
- **New/modified lines:** ~65
- **Tests/validation:** Tool toggles block enabled state
- **Value delivered:** Block enable/disable capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2, 2.1

### Phase 5: Add Edge and State Tools (Est. 0.5 days)

**Commits in this phase: 3**

#### Commit 5.1: Replace add_edge tool
- **Steps:**
  1. Rewrite `src/tools/edges/add.ts` to use operations endpoint
  2. Use `workflowOperation()` with `add` operation, `edge` target
  3. Keep same external interface
- **Files:** `src/tools/edges/add.ts`
- **New/modified lines:** ~60 (rewrite)
- **Tests/validation:** Tool adds edge between blocks
- **Value delivered:** Working edge creation
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2

#### Commit 5.2: Replace remove_edge tool
- **Steps:**
  1. Rewrite `src/tools/edges/remove.ts` to use operations endpoint
  2. Use `workflowOperation()` with `remove` operation, `edge` target
  3. Keep same external interface
- **Files:** `src/tools/edges/remove.ts`
- **New/modified lines:** ~55 (rewrite)
- **Tests/validation:** Tool removes edge
- **Value delivered:** Working edge deletion
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2

#### Commit 5.3: Add replace_workflow_state tool
- **Steps:**
  1. Create `src/tools/workflow/replace-state.ts`
  2. Use `workflowOperation()` with `replace-state` operation
  3. Add JSON Schema for MCP
  4. Update `src/tools/workflow/index.ts`
- **Files:** `src/tools/workflow/replace-state.ts`, `src/tools/workflow/index.ts`
- **New/modified lines:** ~75
- **Tests/validation:** Tool replaces entire workflow state
- **Value delivered:** Full state update capability
- **Independently committable:** Yes
- **Dependencies:** Commit 1.2, 2.1

### Phase 6: Remove Broken Tools & Update Server (Est. 0.5 days)

**Commits in this phase: 2**

#### Commit 6.1: Remove broken tool files
- **Steps:**
  1. Delete `src/tools/workflow/create.ts`
  2. Delete `src/tools/workflow/update.ts`
  3. Delete `src/tools/blocks/add.ts`
  4. Delete `src/tools/blocks/update.ts`
  5. Delete `src/tools/blocks/remove.ts`
  6. Update all index.ts exports
- **Files:** Multiple deletions, index.ts updates
- **Removed lines:** ~500
- **Tests/validation:** TypeScript compiles, no dangling imports
- **Value delivered:** Clean codebase without dead code
- **Independently committable:** Yes
- **Dependencies:** Phase 3, 4, 5

#### Commit 6.2: Update server.ts tool registration
- **Steps:**
  1. Update `ListToolsRequestSchema` handler with new tools
  2. Update `CallToolRequestSchema` handler with new tool dispatch
  3. Remove old tool registrations
  4. Add new tool registrations (11 new tools)
- **Files:** `src/server.ts`
- **Modified lines:** ~150
- **Tests/validation:** Server starts, lists correct tools
- **Value delivered:** All new tools accessible via MCP
- **Independently committable:** Yes
- **Dependencies:** Commit 6.1

### Phase 7: Update Tests (Est. 1.5 days)

**Commits in this phase: 4**

#### Commit 7.1: Update mock client with new methods
- **Steps:**
  1. Add `workflowOperation()` mock
  2. Add `exportWorkflow()` mock
  3. Add `importWorkflow()` mock
  4. Add mock data for operations
  5. Remove deprecated method mocks
- **Files:** `tests/mocks/sim-api.ts`
- **Modified lines:** ~100
- **Tests/validation:** Mocks work correctly
- **Value delivered:** Test infrastructure for new tools
- **Independently committable:** Yes
- **Dependencies:** Phase 1

#### Commit 7.2: Rewrite blocks.test.ts
- **Steps:**
  1. Remove tests for old tools (add_block, update_block, remove_block)
  2. Add tests for add_blocks
  3. Add tests for remove_blocks
  4. Add tests for update_block_position
  5. Add tests for update_block_name
  6. Add tests for toggle_block_enabled
- **Files:** `tests/unit/tools/blocks.test.ts`
- **Modified lines:** ~400 (full rewrite)
- **Tests/validation:** All tests pass
- **Value delivered:** Test coverage for new block tools
- **Independently committable:** Yes
- **Dependencies:** Commit 7.1, Phase 4

#### Commit 7.3: Update edges.test.ts
- **Steps:**
  1. Update add_edge tests for operations-based implementation
  2. Update remove_edge tests for operations-based implementation
  3. Update mock expectations
- **Files:** `tests/unit/tools/edges.test.ts`
- **Modified lines:** ~150
- **Tests/validation:** All tests pass
- **Value delivered:** Test coverage for edge tools
- **Independently committable:** Yes
- **Dependencies:** Commit 7.1, Phase 5

#### Commit 7.4: Update workflow.test.ts
- **Steps:**
  1. Remove tests for create_workflow, update_workflow
  2. Add tests for export_workflow
  3. Add tests for import_workflow
  4. Add tests for replace_workflow_state
- **Files:** `tests/unit/tools/workflow.test.ts`
- **Modified lines:** ~200
- **Tests/validation:** All tests pass
- **Value delivered:** Test coverage for new workflow tools
- **Independently committable:** Yes
- **Dependencies:** Commit 7.1, Phase 3, 5

## Summary

- **Total commits:** 20
- **Total new code:** ~1,000 lines
- **Total removed:** ~750 lines
- **Net change:** ~+250 lines
- **Total estimated time:** 5-6 days

### Tool Inventory Change

| Before | After |
|--------|-------|
| 12 tools (7 broken) | 15 tools (all working) |
| 4 working | 4 unchanged |
| 7 broken | 0 broken |
| 0 import/export | 2 import/export |
| 0 operation-based | 9 operation-based |

### Final Tool List (15 tools)

| # | Tool | Category | Status |
|---|------|----------|--------|
| 1 | `list_workflows` | Workflow | Unchanged |
| 2 | `get_workflow` | Workflow | Unchanged |
| 3 | `delete_workflow` | Workflow | Unchanged |
| 4 | `execute_workflow` | Workflow | Unchanged |
| 5 | `export_workflow` | Workflow | NEW |
| 6 | `import_workflow` | Workflow | NEW |
| 7 | `replace_workflow_state` | Workflow | NEW |
| 8 | `add_blocks` | Blocks | NEW (replaces add_block) |
| 9 | `remove_blocks` | Blocks | NEW (replaces remove_block) |
| 10 | `update_block_position` | Blocks | NEW (partial replace) |
| 11 | `update_block_name` | Blocks | NEW (partial replace) |
| 12 | `toggle_block_enabled` | Blocks | NEW (partial replace) |
| 13 | `add_edge` | Edges | REPLACED (same name, new impl) |
| 14 | `remove_edge` | Edges | REPLACED (same name, new impl) |
| 15 | `list_tools` | Utility | Unchanged |

### Benefits Achieved
- [ ] All tools functional (no 405 errors)
- [ ] Import/export for workflow backup and sharing
- [ ] Full block CRUD via operations endpoint
- [ ] Full edge CRUD via operations endpoint
- [ ] State replacement for advanced use cases
- [ ] Clean codebase without dead code

### Backward Compatibility
- [ ] 4 working tools unchanged
- [ ] add_edge/remove_edge maintain same interface
- [ ] Test patterns preserved

## Progress Tracking

- [ ] Phase 1 (0/3 commits)
- [ ] Phase 2 (0/1 commits)
- [ ] Phase 3 (0/2 commits)
- [ ] Phase 4 (0/5 commits)
- [ ] Phase 5 (0/3 commits)
- [ ] Phase 6 (0/2 commits)
- [ ] Phase 7 (0/4 commits)

## Questions/Decisions Needed

1. **Naming convention:** Should block tools be singular or batch?
   - **Decision:** Use batch (`add_blocks`, `remove_blocks`) since the operations endpoint supports batch operations natively. Individual operations still work with single-item arrays.

2. **Should we keep `update_block` as a single tool or split?**
   - **Decision:** Split into focused tools (`update_block_position`, `update_block_name`, `toggle_block_enabled`) for clarity and to match the operations endpoint's granular operations.

3. **Edge ID generation:** Should `add_edge` accept an ID or auto-generate?
   - **Decision:** Auto-generate with format `e-{uuid}` to match frontend pattern. Accept optional `edgeId` parameter for explicit control.

4. **Should import_workflow allow overwriting existing workflows?**
   - **Decision:** No - import always creates new. Use `replace_workflow_state` to update existing workflow state.

## Testing Strategy

### Unit Tests
- Test each tool function in isolation with mock client
- Test error handling (NotFoundError, ValidationError, network errors)
- Test parameter validation with Zod schemas
- Test success responses

### Validation Approach
1. Run `npm run build` to verify TypeScript compiles
2. Run `npm test` to verify all tests pass
3. Manual testing with actual sim backend

## Rollout & Rollback

### Rollout Plan
1. Complete all phases
2. Build and test locally
3. Update README with new tool documentation
4. Release new version

### Rollback Plan
- Each commit is independently revertable
- Git tags at each phase completion
- If issues found, revert to last stable phase

## Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Operations endpoint behavior differs from expected | Low | High | Verify schema against actual endpoint before implementing |
| Import/export format changes in backend | Low | Medium | Pin to current format, add version check |
| Test coverage gaps | Medium | Medium | Write tests alongside implementation |
| Breaking change in working tools | Low | High | Explicit tests for unchanged tools |

---

*Plan created: $(date)*
*Last updated: $(date)*
