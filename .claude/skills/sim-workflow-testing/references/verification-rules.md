# Verification Rules

Assertion types, expected outputs, and failure detection methods for verifying
Sim workflow test executions.

---

## Table of Contents

1. [Assertion Types](#assertion-types)
2. [Expected Blocks per Scenario](#expected-blocks-per-scenario)
3. [Output Pattern Matching](#output-pattern-matching)
4. [Failure Detection](#failure-detection)
5. [Success Criteria by Profile](#success-criteria-by-profile)
6. [Database State Assertion](#database-state-assertion-for-data-driven-workflows)
7. [Block-Specific Output Semantics](#block-specific-output-semantics)

---

## Assertion Types

Four types of assertions can be made against execution results:

### 1. Path Assertion

Verifies which blocks executed during the workflow run.

**Format:**
```
ASSERT: trace_block_names EQUALS ["Block A", "Block B", "Block C"]
ASSERT: trace_block_names CONTAINS ["Block B"]
ASSERT: trace_block_names NOT_CONTAINS ["Block X"]
ASSERT: trace_block_count EQUALS 3
```

**How to extract:**
```python
# From get_execution_logs response (details="full", includeTraceSpans=true)
trace_block_names = [span["blockName"] for span in log["traceSpans"]]
```

**Examples:**
```
# Text message should hit text path blocks
ASSERT: trace_block_names CONTAINS ["webhook", "routeByType"]
ASSERT: trace_block_names NOT_CONTAINS ["mediaHandoff"]

# Voice message should hit media path blocks
ASSERT: trace_block_names CONTAINS ["webhook", "routeByType", "isMediaMessage", "mediaHandoff"]
ASSERT: trace_block_names NOT_CONTAINS ["storeUserMessage"]
```

### 2. Condition Result Assertion

Verifies the routing decision made by a condition block.

**Format:**
```
ASSERT: block("<BLOCK_NAME>").conditionResult EQUALS true|false
ASSERT: block("<BLOCK_NAME>").selectedOption CONTAINS "if"|"else"
ASSERT: block("<BLOCK_NAME>").selectedOption EQUALS "<FULL_OPTION_ID>"
```

**How to extract:**
```python
# Find the condition block in trace spans
condition_span = next(s for s in log["traceSpans"] if s["blockName"] == "routeByType")
condition_result = condition_span["output"]["conditionResult"]
selected_option = condition_span["output"]["selectedOption"]
```

**Examples:**
```
# Text message: routeByType should select IF path
ASSERT: block("routeByType").conditionResult EQUALS true
ASSERT: block("routeByType").selectedOption CONTAINS "if"

# Voice message: routeByType should select ELSE path
ASSERT: block("routeByType").conditionResult EQUALS false
ASSERT: block("routeByType").selectedOption CONTAINS "else"

# Voice message: isMediaMessage should select IF path
ASSERT: block("isMediaMessage").conditionResult EQUALS true

# Budget allowed: budgetGate should select IF path
ASSERT: block("budgetGate").conditionResult EQUALS true
ASSERT: block("budgetGate").selectedOption EQUALS "condition-budget-gate-if"

# Budget exceeded: budgetGate should select ELSE path
ASSERT: block("budgetGate").conditionResult EQUALS false
ASSERT: block("budgetGate").selectedOption EQUALS "condition-budget-gate-else"
```

**Known Condition Option IDs (Kamatas PROD — `98c363ef-febc-42cc-82d2-d40b501c5b56`):**

| Block | Block ID | IF Handle | ELSE Handle |
|-------|----------|-----------|-------------|
| routeByType | `5023fc47-0d49-4537-a52b-56a77dc8a806` | `condition-9dd96cb8-c79f-4ebb-82b0-f767ec7365f0-if` | `condition-9dd96cb8-c79f-4ebb-82b0-f767ec7365f0-else` |
| budgetGate | `budget-gate-block` | `condition-budget-gate-if` | `condition-budget-gate-else` |
| isMediaMessage | `ba283aa5-f95a-444f-91b6-677ad0ba0a5d` | `condition-block-9f9c16f6-da15-4e56-a08a-2a036e48832a-if` | implicit else |
| checkIfTheMessageLatest | `403b0102-11a6-4e5f-a11e-e26690b4d366` | `condition-6c9c86c3-b760-4afe-94a1-54aeffac67b5-if` | implicit else |
| checkIfTheMessageLatest2 | `38f4065f-7a60-4002-b3ed-0ede1988ee21` | `condition-35e2d3f8-9317-4e7a-9ff3-350bc975ef18-if` | implicit else |
| hasIkasContext | `453d7dc6-900d-4d7e-adcd-acada210b69d` | `condition-has-context-if` | `condition-has-context-else` |

### 3. Status Assertion

Verifies whether a block succeeded, failed, or was skipped.

**Format:**
```
ASSERT: block("<BLOCK_NAME>").status EQUALS "success"|"error"|"skipped"
ASSERT: execution.status EQUALS "success"|"error"
```

**How to extract:**
```python
block_span = next(s for s in log["traceSpans"] if s["blockName"] == "mediaHandoff")
block_status = block_span["status"]

# Overall execution status
execution_status = log["level"]  # "info" = success, "error" = failure
```

**Examples:**
```
# All blocks in the executed path should succeed
ASSERT: block("webhook").status EQUALS "success"
ASSERT: block("routeByType").status EQUALS "success"
ASSERT: block("mediaHandoff").status EQUALS "success"

# Overall execution should succeed
ASSERT: execution.status EQUALS "success"
```

### 4. Output Assertion

Verifies the content produced by a block.

**Format:**
```
ASSERT: block("<BLOCK_NAME>").output CONTAINS "<SUBSTRING>"
ASSERT: block("<BLOCK_NAME>").output.result MATCHES "<REGEX>"
ASSERT: block("<BLOCK_NAME>").output.result.<FIELD> EQUALS "<VALUE>"
ASSERT: final_output CONTAINS "<SUBSTRING>"
```

> **Naming note:** In trace-span assertions, outputs are wrapped under `.output` (for example `block("Support Agent").output.content`). In workflow tag syntax, use canonical block fields directly (for example `<Support Agent.content>`, `<Memory 1.memories>`, `<Knowledge.results>`).

**How to extract:**
```python
# Block output from trace span
block_span = next(s for s in log["traceSpans"] if s["blockName"] == "mediaHandoff")
block_output = block_span.get("output", {})

# Final workflow output
final_output = log.get("output", {})
```

**Examples:**
```
# Media Handoff should produce structured handoff result
ASSERT: block("mediaHandoff").output.result.mediaType EQUALS "voice"
    OR: block("mediaHandoff").output.result.mediaType EQUALS "image"
    OR: block("mediaHandoff").output.result.mediaType EQUALS "video"

# Verify handoff operation count and success
ASSERT: block("mediaHandoff").output.result.operations LENGTH 4
ASSERT: block("mediaHandoff").output.result.success EQUALS true
ASSERT: block("mediaHandoff").output.result.errors LENGTH 0
ASSERT: block("mediaHandoff").output.stdout NOT_EMPTY

# Support Agent should produce a response
ASSERT: block("supportAgent").output.content NOT_EMPTY
ASSERT: block("supportAgent").output.content LENGTH > 10

# Budget check should return allowed status
ASSERT: block("budgetCheck").output.rows[0].allowed EQUALS true
```

---

## Expected Blocks per Scenario

Quick reference for which blocks should appear in trace spans for each scenario.

> **Note:** Block names below use the live display names from workflow `98c363ef-febc-42cc-82d2-d40b501c5b56`.
> See `references/block-management.md` for full block ID mapping.

### CONDITION_ONLY Profile

Only condition blocks + trigger are enabled, so traces are short:

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| CR-01: Text greeting | `["webhook", "routeByType"]` |
| CR-02: Product inquiry | `["webhook", "routeByType"]` |
| CR-03: Voice message | `["webhook", "routeByType", "isMediaMessage"]` |
| CR-04: Outgoing message | `["webhook", "routeByType", "isMediaMessage"]` |

### PATH_ISOLATION — Budget Path

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| BG-01: Budget available | `["webhook", "routeByType", "budgetCheck", "budgetGate", "buildCompositeKey", ...]` |
| BG-02: Budget exceeded | `["webhook", "routeByType", "budgetCheck", "budgetGate", "budgetHandoff"]` |
| BG-03: Budget disabled | `["webhook", "routeByType", "budgetCheck", "budgetGate", "buildCompositeKey", ...]` |

### PATH_ISOLATION — Media Path

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| MH-01: Voice handoff | `["webhook", "routeByType", "isMediaMessage", "mediaHandoff"]` |

### FULL_INTEGRATION

| Scenario | Expected Trace Blocks |
|----------|-----------------------|
| FI-01: Full text flow | `["webhook", "routeByType", "budgetCheck", "budgetGate", "buildCompositeKey", "fetchCustomerInformation", "storeUserMessage", "setLatestMessageId", "debounceWait", "getLatestMessageId", "checkIfTheMessageLatest", "agentLoop", "supportAgent", "agentVariable", ...]` |

> Note: Full trace continues through post-agent processing (getLatestMessageId2 → checkIfTheMessageLatest2 →
> extractSearchContext → hasIkasContext → [storeIkasContext →] conversationHistory). Parallel blocks
> (fetchCustomerInformation / storeUserMessage) may appear in either order.

---

## Output Pattern Matching

### Media Handoff Expected Outputs

The mediaHandoff function block should produce output that includes:

| Media Type | Expected Output Pattern |
|------------|------------------------|
| Voice (audio) | `result` contains acknowledgment referencing voice/audio message |
| Image | `result` contains acknowledgment referencing photo/image |
| Video | `result` contains acknowledgment referencing video |

**Turkish language patterns to check:**
```
Voice: "sesli mesaj" (voice message)
Image: "fotoğraf" (photo) or "görsel" (image)
Video: "video"
General: "ekibimize iletildi" (forwarded to our team)
```

### Support Agent Expected Outputs

When testing with FULL_INTEGRATION profile:

| Input Type | Expected Output Pattern |
|------------|------------------------|
| Greeting ("Merhaba") | Response in Turkish, welcoming, mentions Kamatas |
| Product inquiry ("Sineklik fiyatları") | References sineklik products, may include prices |
| Order status ("Siparişim nerede?") | Asks for order number or phone, or provides status |
| Measurement question | References measurement instructions or videos |

### Condition Block Outputs

| Block | IF Condition | Expected `conditionResult` |
|-------|-------------|---------------------------|
| routeByType | `message_type == "incoming"` AND no media attachments AND `text.length > 0` | `true` for non-empty text, `false` for media/outgoing/empty |
| budgetGate | `budgetCheck.rows[0].allowed == true` | `true` when budget available or disabled, `false` when exceeded |
| isMediaMessage | Has audio/image/video attachment | `true` for media, `false` for non-media |
| checkIfTheMessageLatest | Current message is the latest in conversation | `true` if no newer messages |
| hasIkasContext | Agent tool calls returned ikas data | `true` if ikas context exists |

---

## Failure Detection

### Failure Types

| Failure Type | Detection Method | Common Cause |
|-------------|-----------------|--------------|
| **Wrong Path** | Path assertion fails — wrong blocks in trace | Condition logic error, wrong payload fields |
| **Missing Block** | Expected block not in trace | Block disabled when it shouldn't be, or edge broken |
| **Extra Block** | Unexpected block in trace | Block enabled when it should be disabled |
| **Wrong Condition** | Condition result assertion fails | Condition expression doesn't match expected logic |
| **Block Error** | Status assertion fails — block status is "error" | Runtime error in function/API block |
| **Empty Output** | Output assertion fails — block produced no output | Function returned nothing, API returned empty |
| **Wrong Output** | Output doesn't match expected pattern | Logic error in function block code |
| **Timeout** | Execution takes too long (>30s for simple tests) | Wait blocks, slow API calls |
| **Execution Error** | `execute_workflow` returns `success: false` | Invalid payload, missing env vars, disabled required block |

### Diagnostic Steps

When a test fails:

1. **Check the trace spans** — Which blocks actually executed?
2. **Compare expected vs actual path** — Where did routing diverge?
3. **Check condition outputs** — Was the condition result correct for the input?
4. **Check block outputs** — Did function blocks produce expected results?
5. **Check for errors** — Any block with status "error"?
6. **Verify block states** — Are the right blocks enabled/disabled?
7. **Verify payload** — Does the input match the scenario specification?

### Common Misdiagnoses

| Symptom | Looks Like | Actually Is |
|---------|-----------|-------------|
| No blocks in trace | Workflow broken | Trigger block not matching payload format |
| Only webhook in trace | Condition dropping everything | Condition evaluating payload fields incorrectly |
| Media goes to text path | Media detection broken | Payload missing `attachments` array |
| Text goes to media path | Routing wrong | routeByType condition modified to exclude text+attachment |

---

## Success Criteria by Profile

### CONDITION_ONLY Success

A CONDITION_ONLY test passes when:

- [ ] Correct condition path selected (IF vs ELSE) for each condition block
- [ ] No blocks beyond conditions appear in trace
- [ ] No execution errors
- [ ] Condition result values match expected values

### PATH_ISOLATION Success

A PATH_ISOLATION test passes when:

- [ ] All enabled blocks on the target path appear in trace
- [ ] No blocks from other paths appear in trace
- [ ] All block statuses are "success"
- [ ] Block outputs match expected patterns (if verifiable)
- [ ] No execution errors

### FULL_INTEGRATION Success

A FULL_INTEGRATION test passes when:

- [ ] Complete expected path appears in trace
- [ ] All block statuses are "success"
- [ ] Agent output is relevant and in correct language (Turkish for Kamatas)
- [ ] Tool calls (if any) are appropriate for the input
- [ ] Final output would be a valid customer response
- [ ] Send to Chatwoot block is disabled (no real message sent)

### Cross-Profile Validation

A scenario is fully validated when it passes all applicable profiles:

```
Scenario S-04 (Voice message):
  ✅ CONDITION_ONLY  → Routes to media path (isMediaMessage = true)
  ✅ PATH_ISOLATION  → mediaHandoff executes successfully
  ✅ FULL_INTEGRATION → Complete media handling produces correct acknowledgment
```

---

## Database State Assertion (for data-driven workflows)

When testing workflows with SQL blocks (PostgreSQL, MongoDB, etc.) or memory writes, verify **persistent state changes** via database queries.

### Before-Execute-After Pattern

```sql
-- BEFORE: Get baseline state
SELECT COUNT(*) as baseline FROM table WHERE condition;

-- [Execute workflow via execute_workflow]

-- AFTER: Get final state
SELECT COUNT(*) as final FROM table WHERE condition;

-- Assert: final = baseline + expected_rows
```

### Idempotency Verification

For workflows that should not duplicate data on re-execution:

```sql
-- First execution: baseline = 0 → final = 1 ✅
-- Second execution: baseline = 1 → final = 1 ✅ (idempotent)
-- If final = 2 on second run: ❌ BUG (duplicate inserted)
```

### Consumption/Budget Verification

For workflows with state-dependent branches (e.g., budget exhaustion):

```sql
-- Verify budget state before testing (read-only check)
SELECT
    w.conversation_limit,
    COUNT(c.id) AS used,
    w.is_enabled,
    CASE
        WHEN w.is_enabled = false THEN true          -- disabled = always allowed
        WHEN COUNT(c.id) < w.conversation_limit THEN true
        ELSE false
    END AS allowed
FROM workspace_budget w
LEFT JOIN chatwoot_conversation_consumptions c
    ON c.workspace_id = w.id
    AND c.created_at >= date_trunc('month', CURRENT_TIMESTAMP)
WHERE w.workspace_id = 'ac7ec7a6-f09a-4035-8e96-e9e95b75221b'
GROUP BY w.conversation_limit, w.is_enabled;

-- State 1: conversation_limit = 500, used = 0 → allowed = true
-- State 2: conversation_limit = 5, used = 5  → allowed = false
-- State 3: is_enabled = false                 → allowed = true (fail-open)
```

### Checklist for Data-Driven Workflows

- [ ] Baseline query captures initial state (row count, specific values)
- [ ] Workflow executes (and completes without errors)
- [ ] After query verifies expected state change
- [ ] Row count matches expectation (inserted, deleted, updated correctly)
- [ ] Idempotency test: re-run same payload, verify no duplicate
- [ ] Boundary test: state at exact limit, verify correct routing
- [ ] Cleanup: restore original state for next test

---

## Block-Specific Output Semantics

### PostgreSQL Block Output Semantics

When verifying trace spans from PostgreSQL blocks:

| Field | Meaning | Example |
|---|---|---|
| `rows` | Array of query result rows | `rows: [{"allowed": true}]` for SELECT |
| `rowCount` | Number of rows in result set (NOT insert count) | CTE query returning 1 row: `rowCount: 1` |
| `error` | Error message (if query failed) | Validation error, connection error, etc. |

**Gotcha:** For INSERT...RETURNING or CTE with INSERT, `rowCount` reflects the **SELECT result count**, not the INSERT row count.

Example: CTE with 1 row inserted + 1 row selected returns `rowCount: 1` (the SELECT), not 2.
