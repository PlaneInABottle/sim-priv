# Budget Check Embedded in Kamatas PROD

**Date:** 2026-02-24
**Workflow:** Kamatas PROD v2 test (`98c363ef-febc-42cc-82d2-d40b501c5b56`)
**Workspace:** `ac7ec7a6-f09a-4035-8e96-e9e95b75221b`

## Summary

Embedded PostgreSQL budget check directly into Kamatas PROD workflow, bypassing the separate Budget Decision v1 helper workflow layer.

## Blocks Modified

### 1. budgetCheck (PostgreSQL)
- **ID:** `3b8fdfa3-2b40-4894-b152-49cdac832312`
- **Renamed:** `budgetCheck 1` → `budgetCheck`
- **Query updated:** Replaced `<Start.workspace_id>` / `<Start.conversation_id>` tags with:
  - Hardcoded workspace ID: `825eaf6a-b022-44ed-a7ca-d683a3e9c230` (test workspace)
  - Kamatas webhook tag: `<webhook.conversation.id>`
- **DB connection:** Kept existing Render production credentials (unchanged)
- **Status:** ✅ enabled

### 2. budgetGate (Condition)
- **ID:** `budget-gate-block`
- **Condition fixed:** `<checkBudget.result.allowed> === "true"` → `<budgetCheck.rows[0].allowed> === true`
  - Fixed block name reference (checkBudget → budgetCheck)
  - Fixed output path (result.allowed → rows[0].allowed for PostgreSQL block)
  - Fixed comparison (string "true" → boolean true)
- **Status:** ✅ enabled

### 3. budgetHandoff (Function)
- **ID:** `budget-handoff-block`
- **Code updated:** 4-step Chatwoot API handoff:
  1. Customer acknowledgment (Turkish message about budget limit)
  2. Toggle status to open (human agent)
  3. Add `budget_exceeded` label
  4. Internal note for agents
- **Status:** ✅ enabled (was disabled)

## Edges

| Edge | Source | Target | Status |
|------|--------|--------|--------|
| `afd9e83b` | incomingOnly (if) | budgetCheck | ✅ existing |
| `936a878d` | budgetCheck | budgetGate | ✅ existing |
| `e-ddc39bb9` | budgetGate (if=allowed) | buildCompositeKey | ✅ existing |
| `e-7230d2ef` | budgetGate (else=denied) | budgetHandoff | ✅ existing |
| `e-cc89860d` | budgetHandoff | response (`bdfbabc1`) | ✅ **NEW** |

## Flow

```
webhook → incomingOnly → budgetCheck (PostgreSQL CTE)
                              ↓
                         budgetGate
                        /          \
                   allowed        denied
                      ↓              ↓
              buildCompositeKey   budgetHandoff → response
                      ↓
                 (existing flow continues...)
```

## Test Results

**Execution ID:** `2755ac43-b8a0-4dca-95a4-ecaff8eafa02`
**Duration:** 635ms
**Status:** ✅ PASS

### Trace Spans Verified:
1. ✅ webhook → parsed Chatwoot payload
2. ✅ incomingOnly → condition true, took `if` path
3. ✅ budgetCheck → SQL executed, `rows: [{ allowed: true }]` (428ms)
4. ✅ budgetGate → `true === true`, routed to buildCompositeKey
5. ✅ buildCompositeKey → compositeKey generated

### Tag Resolution Verified:
- `<webhook.conversation.id>` → `123456` (resolved correctly in SQL as `CAST('123456' AS BIGINT)`)

<!-- Updated 2025: refactored from monthly-reset model to flat quota. See docs/budget-refactor.plan.md -->

## CTE Query

```sql
WITH
recent AS (
  SELECT 1 FROM chatwoot_conversation_consumptions
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
    AND chatwoot_conversation_id = CAST('<webhook.conversation.id>' AS BIGINT)
    AND consumed_at > NOW() - INTERVAL '24 hours'
  LIMIT 1
),
budget AS (
  SELECT conversation_limit, is_enabled FROM workspace_budget
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
),
usage AS (
  SELECT COUNT(*)::INTEGER AS used FROM chatwoot_conversation_consumptions
  WHERE workspace_id = '<variable.WORKSPACE_ID>'
),
ins AS (
  INSERT INTO chatwoot_conversation_consumptions
    (id, workspace_id, chatwoot_conversation_id, consumed_at)
  SELECT
    gen_random_uuid()::TEXT,
    '<variable.WORKSPACE_ID>',
    CAST('<webhook.conversation.id>' AS BIGINT),
    NOW()
  WHERE NOT EXISTS (SELECT 1 FROM recent)
    AND (SELECT is_enabled FROM budget) = TRUE
    AND (SELECT used FROM usage) < (SELECT conversation_limit FROM budget)
  RETURNING 1
)
SELECT CASE
  WHEN NOT EXISTS (SELECT 1 FROM budget) THEN TRUE
  WHEN (SELECT is_enabled FROM budget) = FALSE THEN TRUE
  WHEN EXISTS (SELECT 1 FROM recent) THEN TRUE
  WHEN EXISTS (SELECT 1 FROM ins) THEN TRUE
  ELSE FALSE
END AS allowed
```

## Notes

- Budget workspace ID is hardcoded to test workspace (`825eaf6a-...`). Update to production workspace ID when deploying to real customers.
- The `incomingOnly` condition filters before budget check — only text messages from contacts on bot-owned conversations are checked.
- The budgetHandoff sends a Turkish customer acknowledgment: "Aylık mesaj limitinize ulaştınız..."
