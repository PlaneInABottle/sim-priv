# Testing Protocol

Step-by-step execution protocol for AI agents testing Sim Studio workflows.
Follow these steps **in order** for every test run.

---

## Overview

```
Phase 1: PREPARE    → Snapshot block states, create SQL tracking records
Phase 2: CONFIGURE  → Disable blocks per test profile
Phase 3: EXECUTE    → Send payload, capture execution ID
Phase 4: VERIFY     → Inspect trace spans, assert expected behavior
Phase 5: RESTORE    → Re-enable all modified blocks
Phase 6: RECORD     → Update SQL with results, generate summary
```

---

## Phase 1: PREPARE

### 1.1 Identify the Workflow

Fetch the workflow and confirm its structure:

```
get_workflow(workflowId="<WORKFLOW_ID>", verbose=false)
```

Verify:
- Workflow name matches expected (e.g., "Kamatas PROD")
- Block count matches expected (e.g., 22 blocks for Kamatas PROD)
- Workflow is not mid-deployment

### 1.2 Snapshot Block States

Record the current enabled/disabled state of every block:

```
get_workflow(workflowId="<WORKFLOW_ID>", verbose=false)
→ Extract: block.id, block.name, block.enabled for each block
```

Store in SQL:

```sql
-- Create tables if first run
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    profile TEXT NOT NULL,
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT DEFAULT 'running'
);

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    scenario_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    test_group TEXT NOT NULL,
    profile TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | passed | failed | error | timeout | skipped
    execution_id TEXT,
    expected_path TEXT,
    actual_path TEXT,
    expected_output TEXT,
    actual_output TEXT,
    error_message TEXT,
    executed_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS block_snapshots (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    block_id TEXT NOT NULL,
    block_name TEXT NOT NULL,
    original_enabled INTEGER NOT NULL,
    test_enabled INTEGER,
    restored INTEGER DEFAULT 0
);

-- Create test run
INSERT INTO test_runs (id, workflow_id, workflow_name, profile)
VALUES ('<RUN_ID>', '<WORKFLOW_ID>', '<WORKFLOW_NAME>', '<PROFILE>');

-- Snapshot each block (repeat for all blocks)
INSERT INTO block_snapshots (id, run_id, block_id, block_name, original_enabled)
VALUES ('<SNAPSHOT_ID>', '<RUN_ID>', '<BLOCK_ID>', '<BLOCK_NAME>', 1);
```

### 1.3 Select Test Scenarios

Choose scenarios from the company test suite. Example:

```sql
-- Track which scenarios we're running
INSERT INTO test_results (id, run_id, scenario_id, scenario_name, test_group, profile)
VALUES
    ('res-001', 'run-001', 'CR-01', 'Text message → text path', 'condition_routing', 'CONDITION_ONLY'),
    ('res-002', 'run-001', 'CR-02', 'Outgoing message → dropped', 'condition_routing', 'CONDITION_ONLY'),
    ('res-003', 'run-001', 'CR-03', 'Voice message → media path', 'condition_routing', 'CONDITION_ONLY');
```

### 1.4 Concurrency Constraint

⚠️ **Only one AI agent may test a workflow at a time.**

If multiple agents attempt simultaneous testing of the same workflow:
- Block disable/enable operations will interleave
- Agent A disables blocks 1-10, Agent B disables 5-15
- When Agent A restores, it re-enables 5-15 that Agent B needs disabled
- Both tests produce wrong results; state corruption occurs

Mitigation:
- Document in team coordination: "Testing in progress on [workflow], do not start parallel tests"
- Use SQL session-local locks (per-agent, not shared)
- Future: implement shared advisory lock via external coordination service

For now: enforce one-agent-per-workflow via team coordination.

---

## Phase 2: CONFIGURE

### 2.1 Determine Blocks to Disable

Look up the disable list for your test profile in the company test suite.

**CONDITION_ONLY** — Disable everything except trigger + condition blocks:

```
Keep enabled:
  - Webhook 1 (trigger — always enabled)
  - Incoming Only (condition under test)
  - Is Media Message? (condition under test)

Disable:
  - All function blocks
  - All memory blocks
  - All API blocks
  - All agent blocks
  - All wait blocks
  - All loop blocks
  - All variable blocks
  - All workflow_input blocks
```

**PATH_ISOLATION (media path)** — Keep only the media path enabled:

```
Keep enabled:
  - Webhook 1
  - Incoming Only
  - Is Media Message?
  - Media Handoff

Disable:
  - All text path blocks (fetchCustomerInfo through Send to Chatwoot)
```

**⚠️ Side-Effect Warning (PATH_ISOLATION media):**

The Media Handoff function block makes real Chatwoot API calls:
  - POST to `/conversations/{id}/toggle_status`
  - POST to `/conversations/{id}/labels`
  - POST to `/conversations/{id}/messages` (internal note)

To minimize production impact during testing:
  - Use **test conversation IDs** (e.g., `conversation.id=99999`) in your payloads
  - Or accept these calls as part of integration testing and monitor Chatwoot logs
  - These are destructive operations (status changes, label additions), not read-only

**PATH_ISOLATION (text path)** — Keep only the text path enabled:

```
Keep enabled:
  - Webhook 1
  - Incoming Only
  - Text path blocks (fetchCustomerInfo → ... → Send to Chatwoot)

Disable:
  - Is Media Message?
  - Media Handoff
  - Optionally: Support Agent (to avoid token cost)
  - Optionally: Send to Chatwoot (to avoid real messages)
```

**FULL_INTEGRATION** — Keep everything except the final send:

```
Keep enabled:
  - All blocks

Disable:
  - Send to Chatwoot (No Files) 1 (prevents real message delivery)
```

### 2.2 Toggle Blocks Off

For each block to disable, call:

```
toggle_block_enabled(
    workflowId="<WORKFLOW_ID>",
    blockId="<BLOCK_ID>",
    enabled=false
)
```

Update the snapshot:

```sql
UPDATE block_snapshots
SET test_enabled = 0
WHERE run_id = '<RUN_ID>' AND block_id = '<BLOCK_ID>';
```

### 2.3 Verify Configuration

Re-fetch the workflow to confirm blocks are disabled:

```
get_workflow(workflowId="<WORKFLOW_ID>", verbose=false)
→ Verify: disabled blocks show enabled=false
```

**Checkpoint:** Count enabled vs disabled blocks. Compare against expected profile.

### 2.4 Creating Mock Blocks for Side-Effect-Free Testing

For workflows with external API calls (Chatwoot handoff, Slack notifications), create temporary **mock function blocks** to eliminate dependencies and costs during testing.

**Pattern:** Replace the real block with a lightweight function block returning static JSON.

**Example:** Budget system testing
- Real handoff: calls Chatwoot `/toggle_status` API
- Mock handoff: function block returning `{"handoff": true, "reason": "budget_exceeded"}`
- Benefit: Test routing + logic without side effects, zero cost, deterministic

**Implementation:**
1. Create function block with simple code: `return { handoff: true, reason: '...' }`
2. Wire it as the target for your test condition/path
3. Execute in CONDITION_ONLY or PATH_ISOLATION profile (both skip real function execution)
4. Verify route reaches mock block via trace spans
5. Delete mock block after testing, restore real block

**When to use:** Any workflow with external APIs (Slack, Chatwoot, email, webhooks). Mock blocks make tests fast, cheap, and repeatable.

---

## Phase 3: EXECUTE

### 3.1 Build the Payload

Construct the test payload using templates from `payload-templates.md`.

For webhook-triggered workflows:

```
execute_workflow(
    workflowId="<WORKFLOW_ID>",
    triggerType="webhook",
    useDraftState=true,
    input={
        // Payload fields from template
        "event": "message_created",
        "message_type": "incoming",
        "content": "<TEST_CONTENT>",
        // ... scenario-specific overrides
    }
)
```

`triggerType` canonical values: `api` | `manual` | `schedule` | `chat` | `webhook` | `mcp` | `a2a`

### 3.2 Capture Execution Result

The `execute_workflow` response contains:

```json
{
    "success": true,
    "executionId": "exec-abc123",
    "output": { ... },
    "metadata": {
        "duration": 1234,
        "startTime": "2026-02-11T10:00:00.000Z",
        "endTime": "2026-02-11T10:00:01.234Z"
    }
}
```

Record the execution ID:

```sql
UPDATE test_results
SET execution_id = '<EXECUTION_ID>'
WHERE id = '<RESULT_ID>';
```

### 3.3 Handle Execution Errors

If `success` is `false`:

```sql
UPDATE test_results
SET status = 'error',
    error_message = '<ERROR_DETAILS>'
WHERE id = '<RESULT_ID>';
```

Common errors:
- **Block disabled that shouldn't be** — Check your disable list
- **Missing environment variable** — Workflow needs `{{ENV_VAR}}` that isn't set
- **Timeout** — Wait blocks or API calls timing out
- **Invalid payload** — Check payload structure matches trigger expectations

### 3.4 Timeout Handling

Set maximum wait times per profile:
- **CONDITION_ONLY**: 10 seconds (no I/O blocks, instant return expected)
- **PATH_ISOLATION (media)**: 15 seconds (function block only, no AI)
- **PATH_ISOLATION (text)**: 60 seconds (includes debounceWait blocks up to 45s)
- **FULL_INTEGRATION**: 120 seconds (includes Agent block + wait blocks)

If `execute_workflow` does not return within the timeout:
1. Record status = 'timeout' in test_results SQL
2. Proceed IMMEDIATELY to Phase 5 (RESTORE)
3. Do not attempt to fetch execution logs (Phase 4)
4. Restore blocks to original state
5. Report: "Test timeout after [duration]s on profile [profile]"

Example in Phase 3.3 (error recording):
```sql
INSERT INTO test_results (id, run_id, scenario_id, scenario_name, test_group, profile, status, error_message)
VALUES ('<RESULT_ID>', '<RUN_ID>', '<SCENARIO_ID>', '<NAME>', '<GROUP>', '<PROFILE>',
        'timeout', 'Execute took >' || '<TIMEOUT>' || 's');
```

---

## Phase 4: VERIFY

### 4.1 Fetch Execution Logs

From Phase 3.2, you have `executionId`. Use it to fetch the test's execution logs:

**Preferred Approach (RECOMMENDED):**

```
get_execution_logs(
    workspaceId="<WORKSPACE_ID>",
    executionId="<EXEC_ID_FROM_PHASE_3>",
    details="full",
    includeTraceSpans=true,
    includeFinalOutput=true
)
```

Use the `executionId` returned from Phase 3.2 (`execute_workflow` response) to fetch the
specific test execution's log — not just the most recent log. On workflows with high traffic,
omitting `executionId` will verify the WRONG execution.

The API returns an array with 1 log entry (your test's execution).

**Alternative Approach (Two-step):**

```
// Step 1: Fetch basic logs by executionId to get logId
logs = get_execution_logs(workspaceId=..., executionId="<EXEC_ID>")
logId = logs[0].id

// Step 2: Get full details
detail = get_execution_log_detail(logId=logId)
```

**Use Preferred Approach.** It's more direct.

### 4.2 Extract Trace Spans

Trace spans show which blocks executed and in what order. Example structure:

```json
{
    "traceSpans": [
        {
            "blockId": "f3d0bdbd-2304-40ee-84ef-210613d7828a",
            "blockName": "Webhook 1",
            "blockType": "generic_webhook",
            "startTime": "2026-02-11T10:00:00.100Z",
            "endTime": "2026-02-11T10:00:00.150Z",
            "status": "success"
        },
        {
            "blockId": "dcad3f5b-de7c-4f67-b144-aea1bd924ea9",
            "blockName": "Incoming Only",
            "blockType": "condition",
            "startTime": "2026-02-11T10:00:00.155Z",
            "endTime": "2026-02-11T10:00:00.160Z",
            "status": "success",
            "output": {
                "conditionResult": true,
                "selectedOption": "condition-9dd96cb8-if"
            }
        }
    ]
}
```

### 4.3 Run Assertions

Apply verification rules from `verification-rules.md`. Four assertion types:

**Path Assertion** — Check which blocks executed:
```
ASSERT: trace_block_names EQUALS ["Webhook 1", "Incoming Only"]
```

**Condition Result Assertion** — Check condition routing:
```
ASSERT: block("Incoming Only").conditionResult EQUALS true
ASSERT: block("Incoming Only").selectedOption CONTAINS "if"
```

**Status Assertion** — Check block success/failure:
```
ASSERT: block("Webhook 1").status EQUALS "success"
```

**Output Assertion** — Check block output content:
```
ASSERT: block("Media Handoff").output.result CONTAINS "handoff"
```

### 4.4 Record Verification Results

```sql
-- On success
UPDATE test_results
SET status = 'passed',
    actual_path = '<JSON_ARRAY_OF_EXECUTED_BLOCKS>',
    actual_output = '<RELEVANT_OUTPUT>'
WHERE id = '<RESULT_ID>';

-- On failure
UPDATE test_results
SET status = 'failed',
    actual_path = '<JSON_ARRAY_OF_EXECUTED_BLOCKS>',
    actual_output = '<RELEVANT_OUTPUT>',
    error_message = 'Expected path X but got Y'
WHERE id = '<RESULT_ID>';
```

---

## Phase 5: RESTORE

### 5.1 Re-Enable All Disabled Blocks

**This phase is MANDATORY. Always restore, even if tests fail or error.**

Query the snapshot for blocks that were modified:

```sql
SELECT block_id, block_name, original_enabled
FROM block_snapshots
WHERE run_id = '<RUN_ID>' AND test_enabled IS NOT NULL AND restored = 0;
```

For each block, restore to original state:

```
toggle_block_enabled(
    workflowId="<WORKFLOW_ID>",
    blockId="<BLOCK_ID>",
    enabled=<ORIGINAL_ENABLED>  -- from block_snapshots.original_enabled
)
```

Always restore to the ORIGINAL state recorded in the snapshot, not always to `true`. If a block was disabled before testing, restoring to `true` changes production state.

Update snapshot:

```sql
UPDATE block_snapshots
SET restored = 1
WHERE run_id = '<RUN_ID>' AND block_id = '<BLOCK_ID>';
```

### 5.2 Verify Restoration

Re-fetch the workflow and confirm all blocks match their original state:

```
get_workflow(workflowId="<WORKFLOW_ID>", verbose=false)
→ Verify: all blocks show their original enabled state
```

### 5.3 Confirm Full Restoration

```sql
-- Check for any un-restored blocks
SELECT COUNT(*) as unrestored
FROM block_snapshots
WHERE run_id = '<RUN_ID>' AND restored = 0 AND test_enabled IS NOT NULL;
-- Expected: 0
```

**If any blocks remain un-restored:** Immediately toggle them back and report the issue.

---

## Phase 6: RECORD

### 6.1 Complete the Test Run

```sql
UPDATE test_runs
SET completed_at = datetime('now'),
    status = CASE
        WHEN (SELECT COUNT(*) FROM test_results WHERE run_id = '<RUN_ID>' AND status = 'failed') > 0
        THEN 'failed'
        WHEN (SELECT COUNT(*) FROM test_results WHERE run_id = '<RUN_ID>' AND status = 'error') > 0
        THEN 'error'
        WHEN (SELECT COUNT(*) FROM test_results WHERE run_id = '<RUN_ID>' AND status = 'timeout') > 0
        THEN 'error'
        ELSE 'passed'
    END
WHERE id = '<RUN_ID>';
```

### 6.2 Generate Summary

```sql
SELECT
    r.id as run_id,
    r.workflow_name,
    r.profile,
    r.status as run_status,
    COUNT(t.id) as total_tests,
    SUM(CASE WHEN t.status = 'passed' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN t.status = 'failed' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN t.status = 'error' THEN 1 ELSE 0 END) as errors,
    SUM(CASE WHEN t.status = 'timeout' THEN 1 ELSE 0 END) as timeouts,
    SUM(CASE WHEN t.status = 'skipped' THEN 1 ELSE 0 END) as skipped
FROM test_runs r
LEFT JOIN test_results t ON t.run_id = r.id
WHERE r.id = '<RUN_ID>'
GROUP BY r.id;
```

### 6.3 Report to User

Present results in a clear format:

```
## Test Run Summary: <RUN_ID>
Workflow: Kamatas PROD | Profile: CONDITION_ONLY
Status: PASSED ✅

| Group             | Passed | Failed | Total |
|-------------------|--------|--------|-------|
| condition_routing | 5      | 0      | 5     |
| media_handoff     | 2      | 0      | 2     |

All blocks restored to original state ✅
```

---

## Modifying Workflow State During Testing (Proper vs Improper)

When testing workflows that depend on external state (database configs, feature flags, budget limits), you must use the **same interface that operators will use in production**.

### ❌ IMPROPER: Direct Database Modification

```sql
-- WRONG: Direct SQL update bypasses the operational interface
UPDATE workspace_budget SET is_enabled = false WHERE workspace_id = '...';
UPDATE user_config SET feature_flag = true WHERE id = 123;
```

**Why this is wrong:**
- Operators in production don't have direct database access
- Tests don't verify the actual code path operators will use
- Edge cases in the API/UI layer are never tested
- State changes aren't validated by application constraints

### ✅ PROPER: Use Operational Interfaces

#### Option 1: sim-mcp Block Configuration (for workflow-embedded configs)

If the config is stored in a workflow block's subblock value:

```typescript
// Use sim-mcp to update the block's configuration
sim-mcp-update_subblock({
  workflowId: '68ef6353...',
  blockId: 'a1b2c3d4-0002...',  // The configuration block
  subblockId: 'is_enabled',       // The field to toggle
  value: false                     // New value
})
```

Then execute the workflow. This tests **the actual code path** the operator configuration triggers.

#### Option 2: API Call (for dedicated admin endpoints)

```bash
curl -X POST https://localhost:3000/api/workspace/825eaf6a/budget \
  -H "Authorization: Bearer $API_KEY" \
  -d '{"is_enabled": false, "monthly_limit": 10}'
```

Then execute the workflow.

#### Option 3: Database + Validation Layer (last resort)

If the application has a stored procedure or transaction that enforces constraints:

```sql
CALL update_workspace_config('825eaf6a', '{"is_enabled": false}');
-- NOT: UPDATE workspace_budget SET is_enabled = false;
```

### Real-World Example: Budget System Testing

**Scenario:** Test that disabling the budget system (operational toggle) allows all conversations.

**WRONG approach:**
```sql
UPDATE workspace_budget SET is_enabled = false;  -- ❌ Direct SQL
execute_workflow(...)
UPDATE workspace_budget SET is_enabled = true;   -- ❌ Restore via SQL
```

**CORRECT approach (using sim-mcp):**
```typescript
// Read current subblock value
const blockConfig = sim-mcp-get_block({ workflowId, blockId })
const originalValue = blockConfig.subBlocks.find(s => s.id === 'is_enabled').value

// Toggle via sim-mcp (simulates UI/API operator action)
await sim-mcp-update_subblock({ workflowId, blockId, subblockId: 'is_enabled', value: false })

// Execute workflow (now responds to the config change)
const result = await sim-mcp-execute_workflow({ workflowId, input })

// Verify state change took effect
assert(result.data.allowed === true)  // is_enabled=false allows all

// Restore via sim-mcp (not SQL)
await sim-mcp-update_subblock({ workflowId, blockId, subblockId: 'is_enabled', value: originalValue })
```

### Checklist: Testing State-Dependent Workflows

- [ ] Identify which operational interface governs the state (sim-mcp block config, API endpoint, stored procedure)
- [ ] Use ONLY that interface to modify state during tests
- [ ] Never use raw SQL for test setup/teardown (use it only for read-only verification)
- [ ] Document the interface in your test (so operators understand how to replicate the scenario)
- [ ] Verify state change via trace spans or API response (not by inspecting the database directly)
- [ ] Restore state using the same interface you used to modify it

---

## See Also

- **[error-recovery.md](error-recovery.md)** — Error handling, rollback procedures, multi-scenario batch protocol, profile transitions
- **[custom-tool-testing.md](custom-tool-testing.md)** — Custom tool isolated testing, anti-patterns, development lifecycle, checklists
- **[payload-templates.md](payload-templates.md)** — Webhook payload templates and scenario overrides
- **[verification-rules.md](verification-rules.md)** — Assertion types and expected outputs
