---
name: sim-workflow-testing
description: Comprehensive framework for testing Sim Studio workflows via MCP tools. Use when you need to verify workflow routing logic, condition blocks, media handling, or end-to-end execution correctness — especially for Chatwoot webhook-driven workflows like Kamatas PROD.
---

# Sim Workflow Testing Framework

A structured, repeatable methodology for AI agents to test Sim Studio workflows using
sim-mcp tools. Test workflows by selectively disabling blocks, injecting payloads,
executing against draft state, and verifying trace spans — all without deploying.

## Table of Contents

1. [Key Concepts](#key-concepts)
2. [Architecture Overview](#architecture-overview)
3. [Test Profiles](#test-profiles)
4. [Quick Start](#quick-start)
5. [Reference Files](#reference-files)
6. [SQL Tracking Schema](#sql-tracking-schema)
7. [Safety Rules](#safety-rules)
8. [Common GraphQL Schema Validation Errors](#common-graphql-schema-validation-errors)

---

## Key Concepts

### What This Skill Does

This skill teaches AI agents how to **systematically test Sim workflows** by:

1. **Injecting controlled payloads** — Simulated Chatwoot webhooks with specific field overrides
2. **Disabling blocks** — Isolating specific execution paths by toggling blocks off
3. **Executing against draft state** — Running workflows without deployment (`useDraftState: true`)
4. **Verifying trace spans** — Checking which blocks executed and what they produced
5. **Recording results** — Tracking pass/fail in SQL for session-level reporting

### Why Not Just Execute and Check Output?

Production workflows have **side effects** — they send messages to Chatwoot, call external APIs,
write to memory stores, and trigger child workflows. Testing the full path every time is:

- **Expensive** — AI agent blocks consume tokens ($0.01–0.05 per execution)
- **Destructive** — Sends real messages to real conversations
- **Flaky** — External API responses vary

Instead, we use **test profiles** to control exactly what executes.

### Core Testing Flow

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  1. SNAPSHOT │ ──▶ │  2. DISABLE  │ ──▶ │  3. EXECUTE  │ ──▶ │  4. VERIFY   │ ──▶ │  5. RESTORE  │
│  Save state  │     │  Toggle off   │     │  Run payload │     │  Check trace │     │  Re-enable   │
└─────────────┘     └──────────────┘     └─────────────┘     └──────────────┘     └─────────────┘
```

1. **Snapshot** — Record which blocks are currently enabled/disabled
2. **Disable** — Toggle off blocks per the test profile
3. **Execute** — Send a crafted payload via `execute_workflow`
4. **Verify** — Inspect execution logs and trace spans
5. **Restore** — Re-enable all disabled blocks to original state

---

## Architecture Overview

### Workflow Under Test: Kamatas PROD

```
                                    ┌─────────────────────────────────────────────────┐
                                    │              KAMATAS PROD WORKFLOW               │
                                    │         53408cc2-52fa-46e5-85d7-402d2f42f3a4    │
                                    └─────────────────────────────────────────────────┘

    ┌────────────┐      ┌──────────────┐
    │  Webhook 1 │─────▶│ Incoming Only│──── IF (incoming text) ──────────────────────┐
    │ (trigger)  │      │ (condition)  │                                               │
    └────────────┘      └──────┬───────┘                                               │
                               │                                               ┌───────┴────────┐
                          ELSE │                                               │                 │
                               ▼                                               ▼                 ▼
                     ┌──────────────────┐                          ┌─────────────────┐  ┌──────────────┐
                     │ Is Media Message?│                          │fetchCustomerInfo│  │storeUserMsg  │
                     │   (condition)    │                          │ (workflow_input)│  │  (memory)    │
                     └────────┬─────────┘                          └────────┬────────┘  └──────┬───────┘
                              │                                            │                   │
                     IF media │                                            │                   ▼
                              ▼                                            │           ┌──────────────┐
                     ┌──────────────────┐                                  │           │    API 1     │
                     │  Media Handoff   │                                  │           │  (api call)  │
                     │   (function)     │                                  │           └──────┬───────┘
                     └──────────────────┘                                  │                  │
                                                                           │                  ▼
                                                                           │           ┌──────────────┐
                                                                           │           │ debounceWait │
                                                                           │           │   (wait)     │
                                                                           │           └──────┬───────┘
                                                                           │                  │
                                                                           │                  ▼
                                                                           │          ┌───────────────────┐
                                                                           │          │getLatestMessageId │
                                                                           │          │     (api)         │
                                                                           │          └───────┬───────────┘
                                                                           │                  │
                                                                           │                  ▼
                                                                           │     ┌───────────────────────┐
                                                                           │     │checkIfTheMessageLatest│
                                                                           │     │     (condition)       │
                                                                           │     └───────────┬───────────┘
                                                                           │            IF latest
                                                                           │                 │
                                                                           ▼                 ▼
                                                                   ┌─────────────────────────────────────┐
                                                                   │              Loop 1                 │
                                                                   │  ┌──────────────┐  ┌─────────────┐  │
                                                                   │  │Support Agent │─▶│AgentVariable│  │
                                                                   │  │   (agent)    │  │ (variables) │  │
                                                                   │  │              │─▶│             │  │
                                                                   │  │   (on error) │  └─────────────┘  │
                                                                   │  │      │       │                   │
                                                                   │  │      ▼       │                   │
                                                                   │  │   Wait 2     │                   │
                                                                   │  └──────────────┘                   │
                                                                   └───────────────┬─────────────────────┘
                                                                                   │
                                                                                   ▼
                                                                        ┌────────────────────┐
                                                                        │getLatestMessageId2 │
                                                                        │      (api)         │
                                                                        └─────────┬──────────┘
                                                                                  │
                                                                                  ▼
                                                                   ┌───────────────────────────┐
                                                                   │checkIfTheMessageLatest2   │
                                                                   │       (condition)         │
                                                                   └────────────┬──────────────┘
                                                                           IF latest
                                                                                │
                                                                                ▼
                                                                   ┌────────────────────┐
                                                                   │Extract IKAS Context│
                                                                   │    (function)      │
                                                                   └─────────┬──────────┘
                                                                             │
                                                                             ▼
                                                                   ┌──────────────────┐
                                                                   │Has IKAS Context? │
                                                                   │   (condition)    │
                                                                   └───┬──────────┬───┘
                                                                IF yes│          │ELSE
                                                                      ▼          │
                                                            ┌──────────────┐     │
                                                            │Store IKAS   │     │
                                                            │Context (mem)│     │
                                                            └──────┬──────┘     │
                                                                   │            │
                                                                   ▼            ▼
                                                              ┌──────────────────┐
                                                              │    Memory 1      │
                                                              │   (memory)       │
                                                              └────────┬─────────┘
                                                                       │
                                                                       ▼
                                                              ┌────────────────────────┐
                                                              │Send to Chatwoot        │
                                                              │(No Files) 1 (function) │
                                                              └────────────────────────┘
```

### Block Quick Reference

| # | Block Name | Block ID | Type |
|---|-----------|----------|------|
| 1 | Webhook 1 | `f3d0bdbd` | generic_webhook |
| 2 | Incoming Only | `dcad3f5b` | condition |
| 3 | Is Media Message? | `block-9f9c16f6` | condition |
| 4 | Media Handoff | `block-b0a9fec7` | function |
| 5 | fetchCustomerInformation | `5c001454` | workflow_input |
| 6 | storeUserMessage | `d4b467d3` | memory |
| 7 | API 1 | `ca5acc54` | api |
| 8 | debounceWait | `bc6cc87d` | wait |
| 9 | getLatestMessageId | `c18d418f` | api |
| 10 | checkIfTheMessageLatest | `a057131e` | condition |
| 11 | Loop 1 | `f2c10d85` | loop |
| 12 | Support Agent | `35a00fab` | agent |
| 13 | AgentVariable | `2c432318` | variables |
| 14 | Wait 2 | `598e048a` | wait |
| 15 | getLatestMessageId2 | `cfeba002` | api |
| 16 | checkIfTheMessageLatest2 | `892e0602` | condition |
| 17 | Extract IKAS Context | `89d6feb8` | function |
| 18 | Has IKAS Context? | `77f980fc` | condition |
| 19 | Store IKAS Context | `84cc0a48` | memory |
| 20 | Memory 1 | `e38be766` | memory |
| 21 | Send to Chatwoot (No Files) 1 | `3275b7a8` | function |

> **Note:** Block IDs shown as short prefixes for readability. Full UUIDs are in `references/company-tests/kamatas-test-suite.md`.

---

## Test Profiles

Three isolation levels control how much of the workflow executes during a test:

### CONDITION_ONLY

**Purpose:** Test routing logic without side effects.
**Disables:** All blocks after condition nodes (agents, API calls, functions, memory writes).
**Verifies:** Which condition path was selected (IF vs ELSE).
**Cost:** $0.00 (no AI or API calls).

```
Blocks enabled:  Webhook 1, Incoming Only, Is Media Message?
Blocks disabled: Everything else (18 blocks)
```

### PATH_ISOLATION

**Purpose:** Test a specific execution path with controlled side effects.
**Disables:** Blocks on *other* paths + expensive blocks (AI agent, external APIs).
**Verifies:** Correct block sequence executed on the target path.
**Cost:** $0.00–0.01 (function blocks only).

Example — isolating the media path:
```
Blocks enabled:  Webhook 1, Incoming Only, Is Media Message?, Media Handoff
Blocks disabled: All text path blocks (17 blocks)
```

### FULL_INTEGRATION

**Purpose:** End-to-end test with real AI agent and API calls.
**Disables:** Only the final send block (prevents real Chatwoot messages).
**Verifies:** Full output, tool calls, response quality.
**Cost:** $0.01–0.05 (AI tokens consumed).

```
Blocks enabled:  All except Send to Chatwoot
Blocks disabled: Send to Chatwoot (No Files) 1
```

---

## Quick Start

1. **Pick a test suite:** See `references/company-tests/kamatas-test-suite.md` for Kamatas PROD scenarios.
2. **Choose a profile:** See the decision tree above (CONDITION_ONLY / PATH_ISOLATION / FULL_INTEGRATION).
3. **Follow the protocol:** Execute all 6 phases in `references/testing-protocol.md` (PREPARE → CONFIGURE → EXECUTE → VERIFY → RESTORE → REPORT).
4. **See a complete example:** Read `examples/test-session-example.md` for an end-to-end walkthrough of CR-04 + MH-01.

Expected time: 5–15 minutes per scenario depending on profile.

---

## Workflow Identifiers

Required identifiers for executing tests:

| Identifier | Value | Purpose |
|-----------|-------|---------|
| **workspaceId** | `ac7ec7a6-f09a-4035-8e96-e9e95b75221b` | Workspace containing Kamatas PROD workflow |
| **workflowId** | `53408cc2-52fa-46e5-85d7-402d2f42f3a4` | Kamatas PROD workflow being tested |
| **blockMap** | See kamatas-test-suite.md:Block Map | All 21 block UUIDs and types |

These values are used in all sim-mcp tool calls (`get_workflow`, `toggle_block_enabled`, `execute_workflow`, etc.).

---

## Reference Files

| File | Purpose | When to Use |
|------|---------|-------------|
| [`references/testing-protocol.md`](references/testing-protocol.md) | Step-by-step execution protocol | Every test run |
| [`references/payload-templates.md`](references/payload-templates.md) | Webhook payloads + scenario overrides | Building test inputs |
| [`references/verification-rules.md`](references/verification-rules.md) | Assertion types + expected outputs | Validating results |
| [`references/company-tests/kamatas-test-suite.md`](references/company-tests/kamatas-test-suite.md) | Complete Kamatas PROD test matrix | Testing Kamatas |
| [`examples/test-session-example.md`](examples/test-session-example.md) | Full walkthrough example | First-time users |

---

## SQL Tracking Schema

Use this schema to track test results within an agent session:

```sql
CREATE TABLE IF NOT EXISTS test_runs (
    id TEXT PRIMARY KEY,
    workflow_id TEXT NOT NULL,
    workflow_name TEXT NOT NULL,
    profile TEXT NOT NULL,         -- CONDITION_ONLY | PATH_ISOLATION | FULL_INTEGRATION
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    status TEXT DEFAULT 'running'  -- running | passed | failed | error
);

CREATE TABLE IF NOT EXISTS test_results (
    id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES test_runs(id),
    scenario_id TEXT NOT NULL,
    scenario_name TEXT NOT NULL,
    test_group TEXT NOT NULL,      -- condition_routing | media_handoff | text_flow | integration
    profile TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending | passed | failed | error | skipped
    execution_id TEXT,
    expected_path TEXT,            -- JSON array of expected block names
    actual_path TEXT,              -- JSON array of actual block names from trace
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
    original_enabled INTEGER NOT NULL,  -- 1 = enabled, 0 = disabled
    test_enabled INTEGER,               -- State during test (null = not modified)
    restored INTEGER DEFAULT 0          -- 1 = restored to original
);
```

Insert a test run:
```sql
INSERT INTO test_runs (id, workflow_id, workflow_name, profile)
VALUES ('run-001', '53408cc2-52fa-46e5-85d7-402d2f42f3a4', 'Kamatas PROD', 'CONDITION_ONLY');
```

Record a result:
```sql
INSERT INTO test_results (id, run_id, scenario_id, scenario_name, test_group, profile, status, expected_path, actual_path)
VALUES ('res-001', 'run-001', 'CR-01', 'Text message routing', 'condition_routing', 'CONDITION_ONLY', 'passed',
        '["Webhook 1", "Incoming Only"]', '["Webhook 1", "Incoming Only"]');
```

Query pass rate:
```sql
SELECT
    test_group,
    COUNT(*) as total,
    SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) as passed,
    ROUND(100.0 * SUM(CASE WHEN status = 'passed' THEN 1 ELSE 0 END) / COUNT(*), 1) as pass_rate
FROM test_results
WHERE run_id = 'run-001'
GROUP BY test_group;
```

---

## Safety Rules

1. **Always snapshot before disabling** — Record original block states so you can restore
2. **Always restore after testing** — Re-enable every block you disabled, even if a test fails
3. **Never deploy during testing** — Use `useDraftState: true` (the default)
4. **Test one scenario at a time** — Don't batch executions; verify each result
5. **Use the CONDITION_ONLY profile first** — Cheapest and safest; validates routing before testing paths
6. **Watch for production traffic** — If the workflow is live, coordinate test windows
7. **Never modify block configuration** — Only toggle enabled/disabled; never change block logic

### Emergency Restore

If something goes wrong mid-test, restore ALL blocks immediately:

1. Fetch workflow:
   ```
   get_workflow(workflowId="53408cc2-52fa-46e5-85d7-402d2f42f3a4", verbose=false)
   ```

2. For each block in the response:
   ```
   toggle_block_enabled(
       workflowId="53408cc2-52fa-46e5-85d7-402d2f42f3a4",
       blockId="<BLOCK_ID>",
       enabled=true
   )
   ```

3. Verify restoration:
   ```
   get_workflow(workflowId="53408cc2-52fa-46e5-85d7-402d2f42f3a4", verbose=false)
   -- Check: no blocks with enabled=false
   ```

Or restore from snapshot:
```sql
SELECT block_id, block_name, original_enabled
FROM block_snapshots
WHERE run_id = 'run-001' AND restored = 0;
-- Then toggle each block back to original_enabled state
```

---

## Common GraphQL Schema Validation Errors

Use this section when Sim workflow blocks call ikas GraphQL endpoints and fail with HTTP 400 validation errors.

### Error Pattern: Nested Variant Type Shape in `searchProducts`

**Observed error:**

```
Cannot query field "id" on type "SearchProductVariantType"
Cannot query field "name" on type "SearchProductVariantType"
Cannot query field "values" on type "SearchProductVariantType"
```

**Why this happens:**

- `searchProducts` returns `productVariantTypes` as `SearchProductVariantType`
- That type is **nested** and does not expose `id/name/values` at the top level
- Correct fields are:
  - `order`
  - `variantType { id name }`
  - `variantValueIds`

Reference: ikas Admin API GraphQL type definitions (`SearchProductVariantType`, `SearchVariantType`) on ikas.dev.

### Correct vs Incorrect Query Examples

```graphql
# ❌ Incorrect (will fail validation)
productVariantTypes {
  id
  name
  values { id name }
}
```

```graphql
# ✅ Correct for searchProducts
productVariantTypes {
  order
  variantType {
    id
    name
  }
  variantValueIds
}
```

```graphql
# ✅ Another valid nested selection
productVariantTypes {
  variantType { id name selectionType }
  variantValueIds
}
```

### How to Identify GraphQL Validation Errors Fast

1. Check HTTP status (often `400`) and inspect GraphQL `errors[].message`.
2. Look for messages starting with `Cannot query field ... on type ...`.
3. Match the failing type in ikas docs (object/type definitions), not assumptions from similarly named types.
4. Verify whether field exists directly on the type or under a nested child object.

### How to Debug Using ikas API Docs

1. Open the exact object definition in ikas docs (e.g., `SearchProductVariantType`).
2. Confirm field names and nullability.
3. Update query selection set to mirror the type structure exactly.
4. Re-run the request and confirm no GraphQL validation errors.
5. Update local TypeScript interfaces to match the new/actual shape.
6. Update tests/fixtures so schema drift is caught earlier.

### Prevention Checklist

- [ ] For every new query field, confirm it on the exact ikas GraphQL type definition.
- [ ] Treat `search*` types as potentially different from `list*` types.
- [ ] Avoid flattening nested fields unless schema explicitly allows it.
- [ ] Keep TS response interfaces synchronized with query selections.
- [ ] Add/maintain tests with realistic response fixtures for nested objects.
- [ ] When errors mention `Cannot query field`, fix schema mismatch first (before retry logic).

---

## Custom Tool Schema Best Practices

### AI-Readable Tool Descriptions

**Tool schema descriptions must be explicit - LLMs read them to understand usage.**

**BAD (vague):**
```json
"dimensions": {
  "description": "Optional W×H in cm",
  "properties": {
    "width": {"type": "number"},
    "height": {"type": "number"}
  }
}
```

**GOOD (explicit):**
```json
"dimensions": {
  "description": "Customer's opening dimensions in cm. REQUIRED when customer provides dimensions (e.g., '80x180', 'en 80 boy 180'). Used to filter products: strictFit (≥ requested), toleranceFit (0-2cm smaller), excluded (too small). Omit only when not specified yet.",
  "properties": {
    "width": {"type": "number", "description": "Width in cm (en). Opening width that product must cover."},
    "height": {"type": "number", "description": "Height in cm (boy). Opening height that product must cover."}
  }
}
```

**Key differences:**
- ✅ States when parameter is REQUIRED
- ✅ Gives examples in customer's language
- ✅ Explains what the parameter does (filtering logic)
- ✅ Clarifies field meanings (width = en, height = boy)
- ✅ Explains when to omit

### Dimension Filtering Anti-Patterns

| Anti-Pattern | Problem | Fix |
|--------------|---------|-----|
| Agent passes `{width: 0, height: 0}` | Disables filtering, returns all products | Tool schema must say "REQUIRED when customer provides dimensions" |
| Products with `dimensions: null` in strictFit | Tool can't validate fit, agent gets false positives | Separate `unknownDimensions` bucket, never suggest without verification |
| Suggesting products with unparsed dimensions | Agent suggests 290×150 for 80×180 request (150 < 180) | Add slug parsing patterns, exclude when too small |
| No cross-category fallback | Customer needs kapı but only searched pencere | Prompt must include height/width thresholds + routing rules |

---

## Critical: Tag Reference Anti-Patterns

**28 tag reference errors in Kamatas PROD (last 24h) — avoid these mistakes:**

### Anti-Pattern 1: JSDoc Comments with `<>` Tag Syntax ❌ CRITICAL

**Problem:** Tag resolver has **no comment awareness**. It finds `<BlockName.field>` anywhere in code, including comments and strings.

```javascript
// BAD - Tag in JSDoc comment gets resolved
/**
 * Fetches orders for customer
 * Input: <IkasTokenManager.result.token>, <FormatCustomerResponse.result.customer.id>
 */
const orders = await fetchOrders(token, customerId);

// If customer is null, resolver tries to traverse .id on null → CRASH
```

**Fix:** Use plain text in comments, not `<>` syntax:

```javascript
// GOOD - Plain text, not parsed
/**
 * Fetches orders for customer
 * Input: IkasTokenManager.result.token, FormatCustomerResponse.result.customer.id
 * Uses functional code below (not JSDoc) for actual tag resolution
 */
const token = <IkasTokenManager.result.token>;        // ← Real tag, safe
const customerId = <FormatCustomerResponse.result>?.customer?.id;  // ← Shallow tag + guard
```

**Lesson:** Functional code tags are resolved; JSDoc/comments are not. Never use `<>` in comments.

### Anti-Pattern 2: Deep Nested Paths Without Guards ❌ HIGH

**Problem:** Assuming nested fields always exist on nullable objects.

```javascript
// BAD - 9 errors in Kamatas from this pattern
const customerId = <FormatCustomerResponse.result.customer.id>;
// If customer is null/undefined, resolution fails

// BAD - 7 errors from wrong shape assumption
const toolCalls = <supportagent.toolCalls.list>;
// Agent output is an array, not {list: [...]}
```

**Fix:** Use shallow tags + JS guards:

```javascript
// GOOD - Shallow tag + optional chaining
const customerData = <FormatCustomerResponse.result>;
const customerId = customerData?.customer?.id;

// GOOD - Correct shape + handles both formats
const toolCalls = <Support Agent.toolCalls>;
// Normalize in function block if legacy format differs
const normalized = Array.isArray(toolCalls) 
  ? toolCalls 
  : (Array.isArray(toolCalls?.list) ? toolCalls.list : []);
```

**Lesson:** Tags are shallow (one level). Stop before nullable objects. Guard with `?.` operator.

### Anti-Pattern 3: Wrong Nested Webhook Field Assumptions ❌ HIGH

**Problem:** Assuming webhook payload has specific nested structure (e.g., `conversation.id`, `conversation.created_at`), but actual shape varies.

```javascript
// BAD - 8 errors in Kamatas from payload structure mismatches
const conversationId = <Webhook 1.conversation.id>;
const createdAt = <Webhook 1.conversation.created_at>;
// Different webhook sources send different shapes
```

**Fix:** Use fallback chains with guards:

```javascript
// GOOD - Fallback chain handles multiple payload shapes
const payload = <Webhook 1>;
const conversationId = payload?.conversation?.id 
  || payload?.conversation_id 
  || payload?.id 
  || 'unknown';

const createdAt = payload?.conversation?.created_at 
  || payload?.created_at 
  || new Date().toISOString();
```

**Lesson:** Webhook payloads are unpredictable. Build fallback chains. Never assume nesting.

### Anti-Pattern 4: Wrong Block Display Names in Tags ❌ HIGH

**Problem:** Using lowercase/normalized names instead of exact display names. Tags must match block display names exactly.

```javascript
// BAD - Block display name is "Support Agent", not "supportagent"
const toolCalls = <supportagent.toolCalls>;  // ← Won't resolve

// BAD - Block display name is "Ikas Token Manager", not all lowercase
const token = <ikastokenmanager.result>;     // ← Won't resolve
```

**Fix:** Always use exact display name as shown in UI:

```javascript
// GOOD - Matches block display name exactly
const toolCalls = <Support Agent.toolCalls>;
const token = <Ikas Token Manager.result>;
```

**Lesson:** Display names are case-sensitive. Check the UI. When in doubt, read the workflow via `get_workflow`.

### Anti-Pattern 5: Invalid Condition Syntax with Tags ❌ MEDIUM

**Problem:** Inserting raw tag tokens into condition expressions without proper syntax.

```javascript
// BAD - Leaves raw <> in JS expression → syntax error
if (<Extract Search Context.result.hasContext>) { ... }

// BAD - Wrapping tag in quotes breaks resolution
if ("<Extract Search Context.result.hasContext>" === true) { ... }
```

**Fix:** Tag syntax must be unwrapped in valid JS:

```javascript
// GOOD - Tag resolves to boolean value, then compared
<Extract Search Context.result.hasContext> === true

// GOOD - For complex conditions
(<Extract Search Context.result.hasContext> === true && <some_block.data> !== null)
```

**Lesson:** Conditions are JavaScript. Tags resolve to values before JS sees them. Don't quote or wrap tags.

### Mandatory Pre-Deployment Checklist

Before **committing or deploying** a workflow, verify:

- [ ] **No `<>` in comments or strings** — Search code for `<` + review all JSDoc blocks
- [ ] **All block display names are exact** — Compare against UI names; case matters
- [ ] **All nested references have guards** — Use `?.` operator for any optional/nullable field
- [ ] **Webhook payload shapes are handled** — Use fallback chains for field alternatives
- [ ] **Condition syntax is valid JS** — Ensure conditions are executable before tag resolution
- [ ] **Execute with test payload first** — Run workflow before deploying; check `get_execution_log_detail` trace
- [ ] **Verify trace shows expected fields** — Inspect actual block outputs before wiring downstream references

### How to Debug Tag Reference Errors

When you see: `"result.customer.id" doesn't exist on block "FormatCustomerResponse"`

1. **Get the block:** `sim-mcp-get_block(workflowId, blockId)`
2. **Check output schema:** What fields does the block actually declare? (for function blocks: always `{result, stdout}`)
3. **Run a test:** `execute_workflow(workflowId, testPayload)` with `useDraftState: true`
4. **Inspect trace:** `get_execution_log_detail(logId)` — look at trace spans for what each block actually outputs
5. **Compare:** Does the tag reference match what the block actually produces?
6. **Fix:** Adjust tag to match actual output; add guards for nullable fields

---

## Known Limitations

### Workflow Design Constraints

- **Wait Blocks:** Workflows with `debounceWait` or `Wait` blocks may cause test timeouts. Set realistic timeouts in your wait blocks (default: 45s) or use CONDITION_ONLY / PATH_ISOLATION profiles to skip them.
- **Non-deterministic Paths:** Parallel branches (e.g., fetchCustomerInformation + storeUserMessage) may execute in any order. Trace assertions should allow flexibility.
- **Conditional Block Execution:** If a downstream block's behavior depends on runtime data (e.g., Store IKAS Context only executes if context exists), the trace may vary. Document conditional expectations.

### External Dependencies

- **Chatwoot API:** Media Handoff tests make real Chatwoot API calls (POST /conversations/{id}/toggle_status, /labels, /messages). Use test conversation IDs to avoid production impact.
- **ikas API:** Functions that call ikas APIs may fail if credentials are not configured. Ensure all oauth tokens and API keys are valid.
- **Environment Variables:** Function blocks may reference env vars (e.g., `RAVEN_URL`). Tests will fail if these are undefined. Pre-populate env vars in test execution context.

### Workflow Traffic

- **Live Traffic Race Conditions:** If the workflow receives real user messages during testing, execution logs may be interleaved. Use the `executionId` filter to isolate your test's logs.
- **High-Traffic Workflows:** On workflows with 100+ executions/day, the snapshot-disable-execute-restore cycle takes longer. Plan test windows accordingly.

### Testing Scope

- **Draft State Only:** Tests execute against draft workflow state, not deployed snapshots. Changes are not visible to production until workflow is deployed.
- **No Webhook Trigger Support:** Tests use `useDraftState=true` which bypasses webhook trigger validation. Actual webhook delivery tests require deployed workflows.

### Payload Limitations

- **Numeric message_type:** Payloads use string `"incoming"` for compatibility. Real Chatwoot sends numeric `0=incoming, 1=outgoing`. This doesn't affect test results but isn't production-realistic.
- **Attachments:** Attachments are simulated with `data_url` fields. Real Chatwoot sends S3 URLs. Tests don't validate actual file downloads.

---

## Roadmap & Future Expansion

### Phase 1 (Current) ✅ Complete

- Single-workflow testing framework for Kamatas PROD
- Three test profiles (CONDITION_ONLY, PATH_ISOLATION, FULL_INTEGRATION)
- Manual scenario definition and payload management
- SQL-based test tracking and reporting

### Phase 2 (Planned) — Multi-Company Framework

- **Auto-Discovery:** AI agent inspects any Sim workflow and generates test scenarios automatically
- **Template-Based Payloads:** Extensible payload generator for different companies (Kamatas, future e-commerce partners)
- **Scenario Registry:** Shared scenario patterns across companies (e.g., "text greeting", "media handoff", "order lookup")
- **Cross-Workflow Testing:** Test multiple related workflows in sequence (e.g., order workflow → tracking workflow)

### Phase 3 (Planned) — CI/CD & Monitoring Integration

- **Regression Scheduling:** Automated test runs on workflow deployment (pre-deploy gate)
- **Performance Baseline:** Track execution times and costs across test runs
- **CI Integration:** GitHub Actions / Render hooks to run tests on push
- **Cost Tracking:** Monitor AI agent costs and external API spend per test profile
- **Historical Comparison:** Identify performance regressions (test got slower, trace added 3 more blocks, etc.)

### Contributing to the Roadmap

To request a feature, add a scenario, or extend to a new company:
1. Check if a Phase 2 / Phase 3 feature covers your need
2. Open an issue with the use case
3. Tag as `testing-framework` for visibility
