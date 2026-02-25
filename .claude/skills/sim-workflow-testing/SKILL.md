---
name: sim-workflow-testing
description: >-
  Comprehensive framework for testing Sim Studio workflows via MCP tools.
  Use this skill for ANY workflow testing, tool testing, or execution verification task.
  Triggers: (1) testing a workflow, (2) verifying condition/routing logic, (3) checking
  trace spans or execution logs, (4) building/testing custom tools, (5) debugging block
  errors or tag reference failures, (6) running test scenarios against Kamatas PROD or
  any Chatwoot webhook-driven workflow, (7) validating media handling or message routing,
  (8) pre-deployment verification, (9) GraphQL schema validation errors in ikas blocks,
  (10) "test", "verify", "execute workflow", "trace spans", "block toggle", "snapshot".
---

# Sim Workflow Testing Framework

A structured, repeatable methodology for AI agents to test Sim Studio workflows using
sim-mcp tools. Test workflows by selectively disabling blocks, injecting payloads,
executing against draft state, and verifying trace spans — all without deploying.

---

## Key Concepts

This skill teaches AI agents how to **systematically test Sim workflows** by:

1. **Injecting controlled payloads** — Simulated Chatwoot webhooks with specific field overrides
2. **Disabling blocks** — Isolating specific execution paths by toggling blocks off
3. **Executing against draft state** — Running workflows without deployment (`useDraftState: true`)
4. **Verifying trace spans** — Checking which blocks executed and what they produced
5. **Recording results** — Tracking pass/fail in SQL for session-level reporting

### Why Not Just Execute and Check Output?

Production workflows have **side effects** — they send messages to Chatwoot, call external APIs,
write to memory stores. Testing the full path every time is expensive, destructive, and flaky.
Instead, use **test profiles** to control exactly what executes.

### Core Testing Flow

```text
SNAPSHOT → DISABLE → EXECUTE → VERIFY → RESTORE
```

1. **Snapshot** — Record which blocks are currently enabled/disabled
2. **Disable** — Toggle off blocks per the test profile
3. **Execute** — Send a crafted payload via `execute_workflow`
4. **Verify** — Inspect execution logs and trace spans
5. **Restore** — Re-enable all disabled blocks to original state

---

## Test Profiles

Three isolation levels control how much of the workflow executes:

| Profile | Purpose | Cost | Blocks Enabled |
|---------|---------|------|----------------|
| **CONDITION_ONLY** | Test routing logic only | $0.00 | Trigger + condition blocks |
| **PATH_ISOLATION** | Test one execution path | $0.00–0.01 | Target path blocks only |
| **FULL_INTEGRATION** | End-to-end with AI agent | $0.01–0.05 | All except final send |

---

## Prerequisites

- **sim-mcp tool access:** You must be able to call workflow tools such as `get_workflow`, `execute_workflow`, and `toggle_block_enabled`.
- **Workspace permissions:** Access to the target `workspaceId` and `workflowId` with permission to read and execute.
- **Runtime availability:** Target Sim environment (local/staging/prod) must be reachable before test execution.
- **Optional SQL tracking:** If recording pass/fail in session SQL, initialize the schema from `references/block-management.md`.

---

## Quick Start

1. **Pick a test suite:** See `references/company-tests/kamatas-test-suite.md`
2. **Choose a profile:** CONDITION_ONLY first (cheapest, safest)
3. **Follow the protocol:** Execute all 6 phases in `references/testing-protocol.md`
4. **Build payloads:** Use templates from `references/payload-templates.md`
5. **Verify results:** Apply assertions from `references/verification-rules.md`

Expected time: 5–15 minutes per scenario depending on profile.

---

## Workflow Identifiers

| Identifier | Value |
|-----------|-------|
| **workspaceId** | `ac7ec7a6-f09a-4035-8e96-e9e95b75221b` |
| **workflowId** | `98c363ef-febc-42cc-82d2-d40b501c5b56` |
| **blockMap** | See `references/block-management.md` |

---

## Reference Files

See `references/TABLE_OF_CONTENTS.md` for the full index. Key files:

| File | When to Load |
|------|-------------|
| [`references/testing-protocol.md`](references/testing-protocol.md) | Every test run — 6-phase execution protocol |
| [`references/payload-templates.md`](references/payload-templates.md) | Building test inputs — base template + scenario overrides |
| [`references/verification-rules.md`](references/verification-rules.md) | Validating results — assertion types + expected outputs |
| [`references/error-recovery.md`](references/error-recovery.md) | Test failures — rollback, batch protocol, profile transitions |
| [`references/block-management.md`](references/block-management.md) | Setup — architecture diagram, block IDs, SQL schema |
| [`references/tag-reference-patterns.md`](references/tag-reference-patterns.md) | Debugging — tag anti-patterns, GraphQL errors, tool schema |
| [`references/custom-tool-testing.md`](references/custom-tool-testing.md) | Building custom tools — isolated testing, lifecycle, anti-patterns |
| [`references/payload-examples.md`](references/payload-examples.md) | Need full JSON payloads — 6 complete examples |
| [`references/company-tests/kamatas-test-suite.md`](references/company-tests/kamatas-test-suite.md) | Testing Kamatas — full test matrix |
| [`../sim-workflows/references/block-types.md`](../sim-workflows/references/block-types.md) | Canonical block outputs and semantics (`memory`, `workflow_input`, `knowledge`, `agent`) |

---

## Safety Rules

1. **Always snapshot before disabling** — Record original block states so you can restore
2. **Always restore after testing** — Re-enable every block you disabled, even if a test fails
3. **Never deploy during testing** — Use `useDraftState: true` (the default)
4. **Test one scenario at a time** — Don't batch executions; verify each result
5. **Use the CONDITION_ONLY profile first** — Cheapest and safest; validates routing before testing paths
6. **Watch for production traffic** — If the workflow is live, coordinate test windows
7. **Never modify block configuration** — Only toggle enabled/disabled; never change block logic
8. **Respect external API limits** — If the workflow calls ikas/Chatwoot APIs, space test runs and account for upstream rate limits.

### Emergency Restore

If something goes wrong mid-test, restore ALL blocks immediately:

1. Fetch workflow: `get_workflow(workflowId="...", verbose=false)`
2. For each block: `toggle_block_enabled(workflowId, blockId, enabled=true)`
3. Verify: re-fetch and check no blocks with `enabled=false`

Or restore from snapshot — see `references/error-recovery.md`.

---

## Known Limitations

- **Wait Blocks:** May cause test timeouts. Use CONDITION_ONLY / PATH_ISOLATION to skip them.
- **Non-deterministic Paths:** Parallel branches may execute in any order. Allow trace flexibility.
- **External APIs:** Media Handoff makes real Chatwoot API calls. Use test conversation IDs.
- **Draft State Only:** Tests execute against draft, not deployed snapshots.
- **Numeric message_type:** Payloads use string `"incoming"` vs Chatwoot's documented numeric `0`. Doesn't affect test results (unverifiable from this codebase).

## Error Response Handling

This skill does not define a single custom API error envelope. Handle failures using the tool response shape:

- Verify `success`/error status from each sim-mcp tool call before proceeding.
- On execution failure, inspect error text and then query execution logs for trace-level details.
- For invalid `workflowId`/`blockId` or permission issues, expect tool-level errors and stop the test flow until corrected.

---

## Related Resources

- **Tag Reference Issues** — See `references/tag-reference-patterns.md` for debugging tag resolution errors
- **Custom Tool Testing** — See `references/custom-tool-testing.md` for anti-patterns and checklists
