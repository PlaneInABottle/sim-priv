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
- Block count matches expected (e.g., 21 blocks for Kamatas PROD)
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
    status TEXT DEFAULT 'pending',
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

## Error Handling

### Test Execution Fails

If `execute_workflow` returns an error:

1. Record the error in SQL
2. Check if blocks need restoring (they might — always restore)
3. Diagnose: Is the payload valid? Are required blocks enabled?
4. Retry once with corrected payload if the error is payload-related
5. Mark as `error` if still failing

### Block Toggle Fails

If `toggle_block_enabled` fails:

1. Retry the toggle operation once
2. If still failing, fetch the workflow to check current state
3. If the block doesn't exist, the workflow may have been modified — abort test run
4. Report the issue and any un-restored blocks

### Partial Restore Failure

If some blocks can't be restored:

1. List all un-restored blocks clearly
2. Try restoring each one individually
3. If all individual attempts fail, report the list of blocks needing manual restoration
4. **Never leave a test run without attempting restore**

### Agent Session Interruption

If the agent session is interrupted mid-test:

1. On next session, check for un-completed test runs:
   ```sql
   SELECT * FROM test_runs WHERE status = 'running';
   ```
2. For each running test, check block snapshots:
   ```sql
   SELECT block_id, block_name FROM block_snapshots
   WHERE run_id = '<RUN_ID>' AND restored = 0 AND test_enabled IS NOT NULL;
   ```
3. Restore any un-restored blocks immediately
4. Mark the test run as `error`

---

## Rollback Procedure

### Emergency Full Rollback (If Restore Phase Fails Catastrophically)

**Situation:** All blocks remain disabled; restore operations failed completely.

**Procedure:**

1. Fetch the workflow state:
   ```
   get_workflow(workflowId="<WORKFLOW_ID>", verbose=false)
   ```

2. For each block returned where enabled=false (or where it should be true):
   ```
   toggle_block_enabled(
       workflowId="<WORKFLOW_ID>",
       blockId="<BLOCK_ID>",
       enabled=true
   )
   ```
   Repeat for all blocks that should be enabled.

3. Verify full restore:
   ```
   get_workflow(workflowId="<WORKFLOW_ID>", verbose=false)
   ```
   Check: zero blocks with enabled=false

4. Report: "Emergency rollback complete. All blocks restored to enabled=true."

### Selective Rollback (From Snapshot)

```python
# 1. Query snapshot
# SELECT block_id, original_enabled FROM block_snapshots WHERE run_id = '<RUN_ID>'

# 2. Restore each to original state
for block_id, original_enabled in snapshot_rows:
    toggle_block_enabled(
        workflowId="<WORKFLOW_ID>",
        blockId=block_id,
        enabled=bool(original_enabled)
    )
```

---

## Multi-Scenario Batch Protocol

When running multiple scenarios under the same test profile:

1. **Snapshot once** — All blocks have the same starting state
2. **Disable once** — Same blocks disabled for all scenarios in the profile
3. **Execute each scenario** — One at a time, capturing each execution ID
4. **Verify each result** — Independently check trace spans per scenario
5. **Restore once** — After ALL scenarios complete

```
PREPARE → CONFIGURE → [EXECUTE → VERIFY] × N scenarios → RESTORE → RECORD
```

This saves time by avoiding repeated disable/restore cycles for the same profile.

### Error Handling During Batch

If a scenario errors (execute_workflow fails, assertion fails, etc.):

1. Record the error in test_results
2. **CONTINUE to the next scenario** (do NOT restore yet, do NOT abort)
3. Keep all blocks disabled for the next scenario
4. Only restore after ALL scenarios complete OR on a CRITICAL error

**CRITICAL Error** = toggle_block_enabled fails, workflow structure changed mid-batch, sim-mcp API error
**NON-CRITICAL Error** = execute_workflow timeout, assertion mismatch, empty response

Example: 3 scenarios, Scenario 1 fails assertion → continue to Scenario 2, keep disabled, test Scenario 2, restore after Scenario 3 completes.

---

## Profile Transition Protocol

When switching between test profiles (e.g., CONDITION_ONLY → PATH_ISOLATION):

1. **Restore all blocks** from the previous profile
2. **Verify restoration** — All blocks back to original state
3. **Start a new test run** — New run ID, new profile
4. **Snapshot again** — Even though states should be the same
5. **Disable per new profile** — Different block set

Never switch profiles without restoring first.
